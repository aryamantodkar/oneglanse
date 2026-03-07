import type { ChildProcess } from "node:child_process";
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

export type LaunchContextOptions = {
	sessionKey?: string;
	profileScope?: string;
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

function buildProxyConfig(): UpstreamProxyConfig | null {
	const host = env.PROXY_HOST?.trim();
	const port = env.PROXY_PORT?.trim();
	if (!host || !port) return null;

	const scheme = normalizeProxyScheme(env.PROXY_SCHEME?.trim() || "http");
	const hostPart =
		host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

	return applyProxyProviderStrategy(
		parseProxyConfig(
			`${scheme}://${hostPart}:${port}`,
			env.PROXY_USERNAME?.trim() || undefined,
			env.PROXY_PASSWORD?.trim() || undefined,
		),
	);
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
	const upstreamProxy = buildProxyConfig();
	const profileIdentity =
		options?.sessionKey ??
		(upstreamProxy ? `proxy:${upstreamProxy.logProxy}` : null);
	const persistProfile = profileIdentity !== null;
	const port = await getFreePort();
	const { dir: userDataDir, isNew: isNewProfile } = await resolveProfileDir(
		provider,
		profileIdentity,
		options?.profileScope,
	);
	const windowSize = {
		width: profile.viewport.width + profile.outerDelta.width,
		height: profile.viewport.height + profile.outerDelta.height,
	};
	const displayHandle = await ensureDisplay(windowSize);
	const display = displayHandle?.display ?? detectDisplay();

	let chromProcess: ChildProcess | null = null;
	let browser: Browser | null = null;
	let forwarder: ProxyForwarderHandle | null = null;
	let workerStealthCleanup: (() => Promise<void>) | null = null;
	let chromiumStderr = "";

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
		await displayHandle?.cleanup().catch(() => null);
		if (!persistProfile) {
			await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
		}
	};

	try {
		await mkdir(userDataDir, { recursive: true });
		await clearChromeProfileLocks(userDataDir);
		const settings = await resolveBrowserSessionSettings(forwarder?.serverUrl);

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
