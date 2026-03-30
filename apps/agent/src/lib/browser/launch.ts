import { firefox } from "playwright-core";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import {
	type Provider,
	resolveAppMode,
	shouldUseProxyInMode,
} from "@oneglanse/types";
import {
	ensureAuthDirectories,
	getRuntimeProfileSeedPlan,
	markRuntimeProfileSeeded,
	prepareRuntimeProfileBootstrap,
} from "@oneglanse/services";
import { logger } from "@oneglanse/utils";
import type { Browser, BrowserContext } from "playwright";
import { env } from "../../env.js";
import {
	resolveCamoufoxLaunchOptions,
	type CamoufoxProxyConfig,
} from "./camoufox.js";
import { detectDisplay, ensureDisplay } from "./display.js";
import { PlaywrightBrowserContextCompat } from "./playwrightCompat.js";
import {
	checkProxyReachable,
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

// Serialize all proxy acquisitions to prevent race conditions where two
// providers fetch the same list and pick the same entry before either has
// added it to the leased set.
let proxyAcquisitionLock = Promise.resolve();

// Proxy quarantine — hosts that trigger bot detection or hard failures are
// quarantined for a cooldown period so they are not immediately reused.
const QUARANTINE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const quarantinedProxies = new Map<string, number>(); // host:port → expiry

type FirefoxLaunchOptions = NonNullable<Parameters<typeof firefox.launch>[0]>;
type FirefoxPersistentLaunchOptions = NonNullable<
	Parameters<typeof firefox.launchPersistentContext>[1]
>;

export function quarantineProxy(hostPort: string): void {
	quarantinedProxies.set(hostPort, Date.now() + QUARANTINE_TTL_MS);
	logger.warn(
		`[proxy-quarantine] ${hostPort} quarantined for ${QUARANTINE_TTL_MS / 60000}min`,
	);
}

function isProxyQuarantined(hostPort: string): boolean {
	const expiry = quarantinedProxies.get(hostPort);
	if (!expiry) return false;
	if (Date.now() >= expiry) {
		quarantinedProxies.delete(hostPort);
		return false;
	}
	return true;
}

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

async function acquireThorDataProxyInner(): Promise<ProxyAllocation> {
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
				hostPort: `${proxy.host}:${proxy.port}`,
			};
		})
		.filter(
			({ serverUrl, hostPort }) =>
				!leasedThorDataProxyUrls.has(serverUrl) &&
				!isProxyQuarantined(hostPort),
		);

	if (candidates.length === 0) {
		throw new Error(
			"ThorData proxy API returned only proxies that are already leased or quarantined.",
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

async function buildProxyAllocationInner(): Promise<ProxyAllocation> {
	if (!shouldUseProxyInMode(resolveAppMode(env.ONEGLANSE_APP_MODE))) {
		return { proxy: null, release: () => {} };
	}

	const proxyProvider = env.PROXY_PROVIDER?.trim().toLowerCase();
	if (proxyProvider === "thordata" && env.THORDATA_PROXY_API_URL?.trim()) {
		return acquireThorDataProxyInner();
	}

	const host = env.PROXY_HOST?.trim();
	const port = env.PROXY_PORT?.trim();
	if (!host || !port) {
		return { proxy: null, release: () => {} };
	}

	const hostPort = `${host}:${port}`;
	if (isProxyQuarantined(hostPort)) {
		throw new Error(
			`proxy ${hostPort} is quarantined — skipping until cooldown expires`,
		);
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

async function buildProxyAllocation(): Promise<ProxyAllocation> {
	const result = proxyAcquisitionLock.then(() => buildProxyAllocationInner());
	proxyAcquisitionLock = result.then(
		() => {},
		() => {},
	);
	return result;
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

export async function launchContext(provider: Provider): Promise<{
	browser: Browser;
	context: BrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
	invalidateProxyHint: () => Promise<void>;
}> {
	let upstreamProxy: UpstreamProxyConfig | null = null;
	let releaseProxyLease = () => {};
	let invalidateProxyHint: () => Promise<void> = async () => {};
	let displayHandle: DisplayHandle | null = null;
	let rawContext: import("playwright-core").BrowserContext | null = null;
	let context: PlaywrightBrowserContextCompat | null = null;

	const cleanup = async () => {
		await context?.close().catch(() => null);
		releaseProxyLease();
		await displayHandle?.cleanup().catch(() => null);
	};

	try {
		logger.log("resolving proxy before browser launch");
		const proxyAllocation = await buildProxyAllocation();
		upstreamProxy = proxyAllocation.proxy;
		releaseProxyLease = proxyAllocation.release;
		if (upstreamProxy) {
			logger.log(
				`selected proxy for browser launch: ${upstreamProxy.logProxy}`,
			);
			const reachable = await checkProxyReachable(
				upstreamProxy.host,
				upstreamProxy.port,
			);
			if (!reachable) {
				throw new Error(
					`proxy connect failed: ${upstreamProxy.logProxy} unreachable (TCP pre-check)`,
				);
			}
			const hostPort = `${upstreamProxy.host}:${upstreamProxy.port}`;
			invalidateProxyHint = async () => {
				quarantineProxy(hostPort);
			};
		} else {
			logger.warn(
				"no proxy resolved for browser launch; using direct connection",
			);
		}

		displayHandle =
			env.CAMOUFOX_HEADLESS_MODE === "headless" ? null : await ensureDisplay();
		const display =
			env.CAMOUFOX_HEADLESS_MODE === "headless"
				? undefined
				: (displayHandle?.display ?? detectDisplay() ?? undefined);

		ensureAuthDirectories();
		const runtimeSeedPlan = await getRuntimeProfileSeedPlan(provider);
		if (runtimeSeedPlan.shouldBootstrap) {
			prepareRuntimeProfileBootstrap(provider);
		}

		const camoufoxOptions = await resolveCamoufoxLaunchOptions({
			display,
			provider,
			proxy: toCamoufoxProxyConfig(upstreamProxy),
		});
		const persistentOptions: FirefoxPersistentLaunchOptions = {
			...(camoufoxOptions as FirefoxLaunchOptions),
			...(runtimeSeedPlan.shouldBootstrap && runtimeSeedPlan.authStatePath
				? { storageState: runtimeSeedPlan.authStatePath }
				: {}),
		};

		rawContext = await firefox.launchPersistentContext(
			runtimeSeedPlan.userDataDir,
			persistentOptions,
		);

		if (runtimeSeedPlan.shouldBootstrap && runtimeSeedPlan.authStateHash) {
			await markRuntimeProfileSeeded(provider, runtimeSeedPlan.authStateHash);
		}

		context = new PlaywrightBrowserContextCompat(rawContext);
		const browser = context.getBrowser();

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
