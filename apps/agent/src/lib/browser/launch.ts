import { mkdir, rm } from "node:fs/promises";
import { firefox } from "playwright-core";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { redis } from "@oneglanse/services";
import type { Browser, BrowserContext } from "playwright";
import { env } from "../../env.js";
import { resolveCamoufoxLaunchOptions, type CamoufoxProxyConfig } from "./camoufox.js";
import { detectDisplay, ensureDisplay } from "./display.js";
import { PlaywrightBrowserContextCompat } from "./playwrightCompat.js";
import {
	clearBrowserProfileLocks,
	isProfileWarmed,
	markProfileWarmed,
	resolveProfileDir,
} from "./profileManager.js";
import { warmUpProfile } from "./profileWarmup.js";
import {
	type ProxyScheme,
	type UpstreamProxyConfig,
} from "./proxy/forwarder.js";
import { applyProxyProviderStrategy } from "./proxy/provider.js";
import type { DisplayHandle } from "./display.js";

const DEFAULT_PROXY_PORT: Record<ProxyScheme, number> = {
	http: 80,
	https: 443,
	socks4: 1080,
	socks5: 1080,
};
const THORDATA_PROXY_API_TIMEOUT_MS = 10_000;
const leasedThorDataProxyUrls = new Set<string>();
type FirefoxPersistentContextOptions = NonNullable<
	Parameters<typeof firefox.launchPersistentContext>[1]
>;

export type LaunchContextOptions = {
	sessionKey?: string;
	profileScope?: string;
	// When set, both gemini and ai-overview jobs with the same key will try to
	// share a proxy session: the first job allocates and stores it in Redis, the
	// second reads and reuses it. On proxy failure, the hint is invalidated so
	// the next retry picks a fresh proxy independently.
	googleSharedProxyKey?: string;
};

type ProxyAllocation = {
	proxy: UpstreamProxyConfig | null;
	release: () => void;
};

function normalizeProxyScheme(protocol: string): ProxyScheme {
	const normalized = protocol.trim().toLowerCase().replace(/:$/, "");

	switch (normalized) {
		case "http":
		case "https":
		case "socks4":
		case "socks5":
			return normalized;
		case "socks":
			return "socks5";
		default:
			throw new Error(`unsupported proxy protocol: ${protocol}`);
	}
}

function normalizeProxyHost(hostname: string): string {
	return hostname.replace(/^\[(.*)\]$/, "$1");
}

function formatProxyServerUrl(
	scheme: ProxyScheme,
	host: string,
	port: number,
): string {
	const hostPart =
		host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
	return `${scheme}://${hostPart}:${port}`;
}

function parseProxyConfig(
	serverUrl: string,
	username?: string,
	password?: string,
): UpstreamProxyConfig {
	const parsed = new URL(serverUrl);
	const scheme = normalizeProxyScheme(parsed.protocol);
	const port = Number(parsed.port || DEFAULT_PROXY_PORT[scheme]);
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		throw new Error(`invalid proxy port: ${parsed.port}`);
	}

	return {
		scheme,
		host: normalizeProxyHost(parsed.hostname),
		port,
		username,
		password,
		serverUrl: `${scheme}://${parsed.host}`,
		logProxy: `${scheme}://${parsed.host}`,
	};
}

function parseThorDataProxyLine(
	value: string,
): { host: string; port: number } | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const separator = trimmed.lastIndexOf(":");
	if (separator <= 0 || separator === trimmed.length - 1) {
		return null;
	}

	const host = normalizeProxyHost(trimmed.slice(0, separator));
	const port = Number(trimmed.slice(separator + 1));
	if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
		return null;
	}

	return { host, port };
}

async function acquireThorDataProxy(): Promise<ProxyAllocation> {
	const apiUrl = env.THORDATA_PROXY_API_URL?.trim();
	if (!apiUrl) {
		throw new Error(
			"THORDATA_PROXY_API_URL is required when using ThorData API proxy discovery.",
		);
	}

	const response = await fetch(apiUrl, {
		headers: { Accept: "text/plain" },
		signal: AbortSignal.timeout(THORDATA_PROXY_API_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(
			`ThorData proxy API failed (${response.status}): ${(await response.text()).slice(0, 200)}`,
		);
	}

	const proxyLines = (await response.text())
		.split(/\r?\n/)
		.map((line) => parseThorDataProxyLine(line))
		.filter((proxy): proxy is { host: string; port: number } => proxy !== null);

	if (proxyLines.length === 0) {
		throw new Error("ThorData proxy API returned no usable proxies.");
	}

	const scheme = normalizeProxyScheme(env.PROXY_SCHEME?.trim() || "http");
	const candidates = proxyLines
		.map((proxy) => {
			const serverUrl = formatProxyServerUrl(scheme, proxy.host, proxy.port);
			return {
				proxy: parseProxyConfig(serverUrl),
				serverUrl,
			};
		})
		.filter(({ serverUrl }) => !leasedThorDataProxyUrls.has(serverUrl));

	if (candidates.length === 0) {
		throw new Error(
			"ThorData proxy API returned only proxies that are already leased by other workers.",
		);
	}

	const selected = candidates[Math.floor(Math.random() * candidates.length)];
	if (!selected) {
		throw new Error("Could not select a ThorData proxy from the API response.");
	}

	leasedThorDataProxyUrls.add(selected.serverUrl);
	return {
		proxy: selected.proxy,
		release: () => {
			leasedThorDataProxyUrls.delete(selected.serverUrl);
		},
	};
}

async function buildProxyAllocation(): Promise<ProxyAllocation> {
	const proxyProvider = env.PROXY_PROVIDER?.trim().toLowerCase();
	if (proxyProvider === "thordata" && env.THORDATA_PROXY_API_URL?.trim()) {
		return acquireThorDataProxy();
	}

	const host = env.PROXY_HOST?.trim();
	const port = env.PROXY_PORT?.trim();
	if (!host || !port) {
		return {
			proxy: null,
			release: () => {},
		};
	}

	const scheme = normalizeProxyScheme(env.PROXY_SCHEME?.trim() || "http");
	return {
		proxy: applyProxyProviderStrategy(
			parseProxyConfig(
				formatProxyServerUrl(scheme, host, Number(port)),
				env.PROXY_USERNAME?.trim() || undefined,
				env.PROXY_PASSWORD?.trim() || undefined,
			),
		),
		release: () => {},
	};
}

// Stored in Redis so gemini + ai-overview jobs in the same group share an IP.
type StoredProxyHint = {
	scheme: ProxyScheme;
	host: string;
	port: number;
	username?: string;
	password?: string;
};

const GOOGLE_PROXY_HINT_REDIS_PREFIX = "google-proxy-hint:";
// Slightly under the ThorData 10-min sticky session so the hint expires before
// the underlying session does.
const GOOGLE_PROXY_HINT_TTL_SECONDS = 540;

async function buildProxyAllocationWithHint(
	googleSharedProxyKey: string | undefined,
): Promise<ProxyAllocation & { invalidateHint: () => Promise<void> }> {
	const redisKey = googleSharedProxyKey
		? `${GOOGLE_PROXY_HINT_REDIS_PREFIX}${googleSharedProxyKey}`
		: null;

	const invalidateHint = async (): Promise<void> => {
		if (redisKey) {
			await redis.del(redisKey).catch(() => {});
		}
	};

	if (redisKey) {
		try {
			const raw = await redis.get(redisKey);
			if (raw) {
				const hint = JSON.parse(raw) as StoredProxyHint;
				const serverUrl = formatProxyServerUrl(hint.scheme, hint.host, hint.port);
				const proxy: UpstreamProxyConfig = {
					scheme: hint.scheme,
					host: hint.host,
					port: hint.port,
					username: hint.username,
					password: hint.password,
					serverUrl,
					logProxy: serverUrl,
				};
				logger.log(`[google-proxy-hint] reusing shared proxy ${proxy.logProxy}`);
				return { proxy, release: () => {}, invalidateHint };
			}
		} catch {
			// Redis unavailable — fall through to normal allocation
		}
	}

	// Normal allocation path
	const allocation = await buildProxyAllocation();

	if (redisKey && allocation.proxy) {
		const hint: StoredProxyHint = {
			scheme: allocation.proxy.scheme,
			host: allocation.proxy.host,
			port: allocation.proxy.port,
			username: allocation.proxy.username,
			password: allocation.proxy.password,
		};
		// SET NX so only the first job wins; subsequent jobs read the same hint.
		await redis
			.set(redisKey, JSON.stringify(hint), "EX", GOOGLE_PROXY_HINT_TTL_SECONDS, "NX")
			.catch(() => {});
		logger.log(`[google-proxy-hint] stored shared proxy ${allocation.proxy.logProxy}`);
	}

	return { ...allocation, invalidateHint };
}

function toCamoufoxProxyConfig(
	proxy: UpstreamProxyConfig | null,
): CamoufoxProxyConfig | undefined {
	if (!proxy) return undefined;
	return {
		server: proxy.serverUrl,
		username: proxy.username,
		password: proxy.password,
	};
}

export async function launchContext(
	provider: Provider,
	options?: LaunchContextOptions,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
	invalidateProxyHint: () => Promise<void>;
}> {
	let upstreamProxy: UpstreamProxyConfig | null = null;
	let releaseProxyLease = () => {};
	let invalidateProxyHint: () => Promise<void> = async () => {};
	let profileIdentity: string | null = options?.sessionKey ?? null;
	let persistProfile = profileIdentity !== null;
	let userDataDir = "";
	let isNewProfile = false;
	let displayHandle: DisplayHandle | null = null;
	let rawContext:
		| import("playwright-core").BrowserContext
		| null = null;
	let context: PlaywrightBrowserContextCompat | null = null;

	const cleanup = async () => {
		await context?.close().catch(() => null);
		await rawContext?.close().catch(() => null);
		releaseProxyLease();
		await displayHandle?.cleanup().catch(() => null);
		if (!persistProfile && userDataDir) {
			await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
		}
	};

	try {
		logger.log("resolving proxy before browser launch");
		const proxyAllocation = await buildProxyAllocationWithHint(options?.googleSharedProxyKey);
		upstreamProxy = proxyAllocation.proxy;
		releaseProxyLease = proxyAllocation.release;
		invalidateProxyHint = proxyAllocation.invalidateHint;
		if (upstreamProxy) {
			logger.log(
				`selected proxy for browser launch: ${upstreamProxy.logProxy}`,
			);
		} else {
			logger.warn("no proxy resolved for browser launch; using direct connection");
		}

		// Profile identity must reflect the actual proxy session so that cookie
		// jars are never reused across different IPs. ThorData (and other sticky
		// proxy providers) encode the session token in the username; including it
		// here ensures each 10-minute sticky window gets its own profile directory
		// and triggers fresh warmup when the session rotates to a new IP.
		// Fall back to the sessionKey (workspace-scoped) only when there is no
		// proxy at all (direct connection), where IP is stable.
		profileIdentity = upstreamProxy
			? `proxy:${upstreamProxy.host}:${upstreamProxy.port}:${upstreamProxy.username ?? ""}`
			: options?.sessionKey ?? null;
		persistProfile = profileIdentity !== null;

		const profileScope = options?.profileScope ?? provider;
		const profileDir = await resolveProfileDir(
			provider,
			profileIdentity,
			profileScope,
		);
		userDataDir = profileDir.dir;
		isNewProfile = profileDir.isNew;
		await mkdir(userDataDir, { recursive: true });
		await clearBrowserProfileLocks(userDataDir);

		displayHandle =
			env.CAMOUFOX_HEADLESS_MODE === "headless" ? null : await ensureDisplay();
		const display =
			env.CAMOUFOX_HEADLESS_MODE === "headless"
				? undefined
				: displayHandle?.display ?? detectDisplay() ?? undefined;

		const camoufoxOptions = await resolveCamoufoxLaunchOptions({
			display,
			provider,
			proxy: toCamoufoxProxyConfig(upstreamProxy),
		});

		const {
			executablePath,
			firefoxUserPrefs,
			...persistentContextOptions
		} = camoufoxOptions;

		rawContext = await firefox.launchPersistentContext(userDataDir, {
			...(persistentContextOptions as FirefoxPersistentContextOptions),
			executablePath,
			firefoxUserPrefs: firefoxUserPrefs as
				| Record<string, string | number | boolean>
				| undefined,
		});

		context = new PlaywrightBrowserContextCompat(rawContext);
		const browser = context.getBrowser();

		if (
			isNewProfile &&
			persistProfile &&
			profileIdentity &&
			!(await isProfileWarmed(provider, profileIdentity, profileScope))
		) {
			try {
				const warmupPage = await context.newPage();
				await warmUpProfile(warmupPage, provider);
				await warmupPage.close().catch(() => null);
				await markProfileWarmed(provider, profileIdentity, profileScope);
			} catch (error) {
				logger.warn(
					`profile warmup failed (non-critical): ${toErrorMessage(error)}`,
				);
			}
		}

		return {
			browser,
			context,
			proxy: upstreamProxy?.logProxy ?? null,
			cleanup,
			invalidateProxyHint,
		};
	} catch (error) {
		await cleanup();
		throw new ExternalServiceError(
			"browser",
			toErrorMessage(error),
			502,
			{ provider },
			error,
		);
	}
}
