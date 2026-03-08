import type { ChildProcess } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { env } from "../../env.js";
import {
	attachWorkerStealthTargets,
	detectDisplay,
	ensureDisplay,
	getFreePort,
	spawnChromiumCDP,
	waitForCDPEndpoint,
} from "./cdp.js";
import {
	clearChromeProfileLocks,
	isProfileWarmed,
	markProfileWarmed,
	resolveProfileDir,
} from "./profileManager.js";
import { warmUpProfile } from "./profileWarmup.js";
import {
	type ProxyForwarderHandle,
	type ProxyScheme,
	type UpstreamProxyConfig,
	createProxyForwarder,
} from "./proxy/forwarder.js";
import { applyProxyProviderStrategy } from "./proxy/provider.js";
import { resolveBrowserSessionSettings } from "./sessionSettings.js";
import {
	type BrowserSessionSettings,
	type SessionProfile,
	buildContextOptions,
	buildStealthInitScript,
	buildWorkerStealthBootstrap,
	generateSessionProfile,
} from "./stealth.js";

const DEFAULT_PROXY_PORT: Record<ProxyScheme, number> = {
	http: 80,
	https: 443,
	socks4: 1080,
	socks5: 1080,
};
const THORDATA_PROXY_API_TIMEOUT_MS = 10_000;
const leasedThorDataProxyUrls = new Set<string>();

export type LaunchContextOptions = {
	sessionKey?: string;
	profileScope?: string;
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

	const selected = candidates[randomInt(candidates.length)];
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
	if (env.PROXY_PROVIDER === "thordata" && env.THORDATA_PROXY_API_URL?.trim()) {
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

export async function launchContext(
	provider: Provider,
	options?: LaunchContextOptions,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	profile: SessionProfile;
	settings: BrowserSessionSettings;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	const profile = generateSessionProfile();
	const windowSize = {
		width: profile.viewport.width + profile.outerDelta.width,
		height: profile.viewport.height + profile.outerDelta.height,
	};

	let upstreamProxy: UpstreamProxyConfig | null = null;
	let releaseProxyLease = () => {};
	let profileIdentity: string | null = options?.sessionKey ?? null;
	let persistProfile = profileIdentity !== null;
	let userDataDir = "";
	let isNewProfile = false;
	let displayHandle: Awaited<ReturnType<typeof ensureDisplay>> | null = null;
	let display: string | undefined;
	let chromProcess: ChildProcess | null = null;
	let browser: Browser | null = null;
	let forwarder: ProxyForwarderHandle | null = null;
	let workerStealthCleanup: (() => Promise<void>) | null = null;
	let chromiumStderr = "";
	let port = 0;

	const cleanup = async () => {
		await workerStealthCleanup?.().catch(() => null);
		await browser?.close().catch(() => null);

		if (chromProcess) {
			try {
				chromProcess.kill("SIGTERM");
				await new Promise((resolve) => setTimeout(resolve, 300));
				if (chromProcess.exitCode === null) {
					chromProcess.kill("SIGKILL");
				}
			} catch {
				// Chromium may have already exited.
			}
		}

		await forwarder?.close().catch(() => null);
		releaseProxyLease();
		await displayHandle?.cleanup().catch(() => null);
		if (!persistProfile && userDataDir) {
			await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
		}
	};

	try {
		logger.log("resolving proxy before browser launch");
		const proxyAllocation = await buildProxyAllocation();
		upstreamProxy = proxyAllocation.proxy;
		releaseProxyLease = proxyAllocation.release;
		if (upstreamProxy) {
			logger.log(`selected proxy for browser launch: ${upstreamProxy.logProxy}`);
		} else {
			logger.warn("no proxy resolved for browser launch; using direct connection");
		}
		port = await getFreePort();
		profileIdentity =
			options?.sessionKey ??
			(upstreamProxy ? `proxy:${upstreamProxy.logProxy}` : null);
		persistProfile = profileIdentity !== null;
		const profileDir = await resolveProfileDir(
			provider,
			profileIdentity,
			options?.profileScope,
		);
		userDataDir = profileDir.dir;
		isNewProfile = profileDir.isNew;
		displayHandle = await ensureDisplay(windowSize);
		display = displayHandle?.display ?? detectDisplay() ?? undefined;
		if (upstreamProxy) {
			forwarder = await createProxyForwarder(upstreamProxy);
			logger.log(
				`launching chromium (proxy: ${upstreamProxy.logProxy})${display ? " [headful/Xvfb]" : " [headless]"}`,
			);
		} else {
			logger.warn("no proxies available, launching without proxy");
			logger.log(
				`launching chromium (direct)${display ? " [headful/Xvfb]" : " [headless]"}`,
			);
		}
		await mkdir(userDataDir, { recursive: true });
		await clearChromeProfileLocks(userDataDir);
		// Use the upstream proxy identity (stable across launches) as the cache key,
		// not the local forwarder port (which is random and changes every launch).
		const settings = await resolveBrowserSessionSettings(
			forwarder?.serverUrl,
			upstreamProxy?.logProxy ?? "direct",
		);

		chromProcess = spawnChromiumCDP(port, userDataDir, {
			proxyServer: forwarder?.serverUrl,
			windowSize,
			locale: settings.locale,
			display: displayHandle?.display,
		});

		chromProcess.stderr?.on("data", (chunk: Buffer | string) => {
			chromiumStderr = `${chromiumStderr}${chunk.toString()}`.slice(-8_192);
		});

		const wsEndpoint = await Promise.race([
			waitForCDPEndpoint(port),
			new Promise<never>((_, reject) => {
				chromProcess?.once("error", reject);
				chromProcess?.once("exit", (code, signal) => {
					reject(
						new Error(
							`Chromium exited before CDP was ready (code=${code ?? "null"}, signal=${signal ?? "null"})`,
						),
					);
				});
			}),
		]);
		browser = await chromium.connectOverCDP(wsEndpoint);
		const browserVersion = browser.version();
		workerStealthCleanup = await attachWorkerStealthTargets(
			wsEndpoint,
			buildWorkerStealthBootstrap(profile, browserVersion, settings),
		).catch((error) => {
			logger.warn(
				`worker stealth auto-attach unavailable, continuing with page-level stealth only: ${toErrorMessage(error)}`,
			);
			return async () => {};
		});

		const context = await browser.newContext(
			buildContextOptions(profile, browserVersion, settings),
		);
		await context.addInitScript(
			buildStealthInitScript(profile, browserVersion, settings),
		);

		// Warm up new profiles to build realistic cookie/cache state
		if (
			isNewProfile &&
			persistProfile &&
			profileIdentity &&
			!(await isProfileWarmed(provider, profileIdentity, options?.profileScope))
		) {
			try {
				const warmupPage = await context.newPage();
				await warmUpProfile(warmupPage);
				await warmupPage.close();
				await markProfileWarmed(
					provider,
					profileIdentity,
					options?.profileScope,
				);
			} catch (err) {
				logger.warn(
					`profile warmup failed (non-critical): ${toErrorMessage(err)}`,
				);
			}
		}

		return {
			browser,
			context,
			profile,
			settings,
			proxy: upstreamProxy?.logProxy ?? null,
			cleanup,
		};
	} catch (err) {
		await cleanup();
		if (
			/process_singleton_posix|profile appears to be in use/i.test(
				chromiumStderr,
			)
		) {
			await clearChromeProfileLocks(userDataDir).catch(() => null);
		}
		throw new ExternalServiceError(
			"browser",
			chromiumStderr.trim()
				? `${toErrorMessage(err)} | chromium stderr: ${chromiumStderr.trim()}`
				: toErrorMessage(err),
			502,
			{ provider },
			err,
		);
	}
}
