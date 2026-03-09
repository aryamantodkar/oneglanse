import type { ChildProcess } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { env } from "../../env.js";
import {
	detectDisplay,
	ensureDisplay,
	materializeChromeExtension,
	readChromeVersion,
	spawnChromeProcess,
} from "./chromeProcess.js";
import { bindContextDisplay, unbindContextDisplay } from "./humanBehavior.js";
import { NativeBridge } from "./native/bridge.js";
import { NativeBrowser, NativeBrowserContext } from "./runtime.js";
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

function pickViewport(): {
	viewport: { width: number; height: number };
	windowSize: { width: number; height: number };
} {
	const candidates = [
		{ width: 1365, height: 768 },
		{ width: 1440, height: 900 },
		{ width: 1536, height: 864 },
		{ width: 1600, height: 900 },
	];
	const viewport = candidates[randomInt(candidates.length)] || candidates[0];
	if (!viewport) {
		return {
			viewport: { width: 1440, height: 900 },
			windowSize: { width: 1440, height: 900 },
		};
	}
	return {
		viewport,
		windowSize: {
			width: viewport.width,
			height: viewport.height,
		},
	};
}

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
	browser: NativeBrowser;
	context: NativeBrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	const { viewport, windowSize } = pickViewport();

	let upstreamProxy: UpstreamProxyConfig | null = null;
	let releaseProxyLease = () => {};
	let profileIdentity: string | null = options?.sessionKey ?? null;
	let persistProfile = profileIdentity !== null;
	let userDataDir = "";
	let isNewProfile = false;
	let displayHandle: Awaited<ReturnType<typeof ensureDisplay>> | null = null;
	let display: string | undefined;
	let chromeProcess: ChildProcess | null = null;
	let chromeStderr = "";
	let forwarder: ProxyForwarderHandle | null = null;
	let bridge: NativeBridge | null = null;
	let extensionAssets: Awaited<
		ReturnType<typeof materializeChromeExtension>
	> | null = null;
	let context: NativeBrowserContext | null = null;
	let browser: NativeBrowser | null = null;
	const profileScope = options?.profileScope ?? provider;

	const cleanup = async () => {
		if (context) {
			unbindContextDisplay(context);
		}

		await context?.close().catch(() => null);

		if (chromeProcess) {
			try {
				chromeProcess.kill("SIGTERM");
				await new Promise((resolve) => setTimeout(resolve, 300));
				if (chromeProcess.exitCode === null) {
					chromeProcess.kill("SIGKILL");
				}
			} catch {
				// Chrome may already be gone.
			}
		}

		await bridge?.close().catch(() => null);
		await forwarder?.close().catch(() => null);
		releaseProxyLease();
		await extensionAssets?.cleanup().catch(() => null);
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
			logger.log(
				`selected proxy for browser launch: ${upstreamProxy.logProxy}`,
			);
		} else {
			logger.warn("no proxy resolved for browser launch; using direct connection");
		}

		profileIdentity =
			options?.sessionKey ??
			(upstreamProxy ? `proxy:${upstreamProxy.logProxy}` : null);
		persistProfile = profileIdentity !== null;

		const profileDir = await resolveProfileDir(
			provider,
			profileIdentity,
			profileScope,
		);
		userDataDir = profileDir.dir;
		isNewProfile = profileDir.isNew;
		await mkdir(userDataDir, { recursive: true });
		await clearChromeProfileLocks(userDataDir);

		displayHandle = await ensureDisplay(windowSize);
		display = displayHandle?.display ?? detectDisplay() ?? undefined;

		if (upstreamProxy) {
			forwarder = await createProxyForwarder(upstreamProxy);
		}

		bridge = await NativeBridge.start();
		extensionAssets = await materializeChromeExtension();
		chromeProcess = spawnChromeProcess({
			userDataDir,
			extensionDir: extensionAssets.extensionDir,
			nativePort: bridge.getPort(),
			windowSize,
			display,
			locale: env.BROWSER_LOCALE?.trim(),
			proxyServer: forwarder?.serverUrl,
		});

		chromeProcess.stderr?.on("data", (chunk: Buffer | string) => {
			chromeStderr = `${chromeStderr}${chunk.toString()}`.slice(-8_192);
		});

		await Promise.race([
			bridge.waitForEvent("host-connected", 20_000),
			new Promise<never>((_, reject) => {
				chromeProcess?.once("error", reject);
				chromeProcess?.once("exit", (code, signal) => {
					reject(
						new Error(
							`Chrome exited before native host was ready (code=${code ?? "null"}, signal=${signal ?? "null"})`,
						),
					);
				});
			}),
		]);
		await bridge.waitForEvent("extension-ready", 20_000);

		context = new NativeBrowserContext(bridge, viewport);
		if (display) {
			bindContextDisplay(context, display);
		}

		const browserVersion = await readChromeVersion().catch(
			() => "Google Chrome",
		);
		browser = new NativeBrowser(browserVersion, cleanup);

		if (
			isNewProfile &&
			persistProfile &&
			profileIdentity &&
			!(await isProfileWarmed(provider, profileIdentity, profileScope))
		) {
			try {
				const warmupPage = await context.newPage();
				await warmUpProfile(warmupPage);
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
		};
	} catch (error) {
		await cleanup();
		throw new ExternalServiceError(
			"browser",
			chromeStderr.trim()
				? `${toErrorMessage(error)} | chrome stderr: ${chromeStderr.trim()}`
				: toErrorMessage(error),
			502,
			{ provider },
			error,
		);
	}
}
