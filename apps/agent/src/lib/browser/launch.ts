import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { logger } from "@oneglanse/utils";
import { fetchProxies, getNextProxy, recordProxyResult } from "./proxy/pool.js";
import { env } from "../../env.js";
import { STEALTH_CONTEXT_OPTIONS, STEALTH_INIT_SCRIPT } from "./stealth.js";
import { getFreePort, killChromiumProcess, spawnChromiumCDP, waitForCDPEndpoint } from "./cdp.js";

const CDP_DIR_PREFIX = "cdp-";
const CDP_DIR_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const CDP_DIR_STALE_AGE_MS = 30 * 60 * 1000;
const SESSION_PLACEHOLDER_RE =
	/\{\{\s*(?:sessid|sessionid|session_id)\s*\}\}|\$\{?\s*(?:sessid|sessionid|session_id)\s*\}?/gi;
const SESSION_KEY_VALUE_RE =
	/((?:sessid|sessionid|session_id|session)[-_:=])([A-Za-z0-9._~%]+)/i;
let lastCdpCleanupAt = 0;

type ProxyAuth = {
	username: string;
	password: string;
	sessionId: string;
};

function generateProxySessionId(provider: Provider): string {
	const providerTag = provider.slice(0, 3).toLowerCase();
	const pidTag = process.pid.toString(36);
	const timeTag = Date.now().toString(36);
	const entropyTag = randomUUID().replace(/-/g, "").slice(0, 12);
	return `${providerTag}${pidTag}${timeTag}${entropyTag}`;
}

function withDynamicSessionId(username: string, sessionId: string): string {
	const withPlaceholder = username.replace(SESSION_PLACEHOLDER_RE, sessionId);
	if (withPlaceholder !== username) {
		return withPlaceholder;
	}

	if (SESSION_KEY_VALUE_RE.test(username)) {
		return username.replace(SESSION_KEY_VALUE_RE, `$1${sessionId}`);
	}

	return `${username}-sessid-${sessionId}`;
}

function buildProxyAuth(provider: Provider): ProxyAuth | null {
	const baseUsername = env.PROXY_USERNAME?.trim();
	const basePassword = env.PROXY_PASSWORD?.trim();
	if (!baseUsername || !basePassword) return null;

	const sessionId = generateProxySessionId(provider);
	return {
		username: withDynamicSessionId(baseUsername, sessionId),
		password: basePassword,
		sessionId,
	};
}

async function cleanupStaleCdpDirs(): Promise<void> {
	const now = Date.now();
	if (now - lastCdpCleanupAt < CDP_DIR_CLEANUP_INTERVAL_MS) return;
	lastCdpCleanupAt = now;

	try {
		const entries = await readdir("/tmp", { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory() || !entry.name.startsWith(CDP_DIR_PREFIX)) continue;
			const dirPath = `/tmp/${entry.name}`;
			try {
				const info = await stat(dirPath);
				const ageMs = now - info.mtimeMs;
				if (ageMs < CDP_DIR_STALE_AGE_MS) continue;
				await rm(dirPath, { recursive: true, force: true });
				logger.warn(
					`Removed stale CDP profile dir ${dirPath} (age ${(ageMs / 60000).toFixed(0)}m)`,
				);
			} catch (err) {
				logger.error(`Failed cleaning stale CDP dir ${dirPath}:`, toErrorMessage(err));
			}
		}
	} catch (err) {
		logger.error("Failed scanning /tmp for stale CDP profile dirs:", toErrorMessage(err));
	}
}

export async function launchContext(
	provider: Provider,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	await cleanupStaleCdpDirs();

	let proxy = getNextProxy();

	if (!proxy) {
		logger.warn(`proxy pool exhausted, refreshing...`);
		try {
			await fetchProxies({ forceRefresh: true });
			proxy = getNextProxy();
		} catch (err) {
			logger.error(`failed to refresh proxy pool:`, toErrorMessage(err));
		}
	}

	if (proxy) {
		const redactedProxy =
			proxy?.replace(/\/\/[^:]+:[^@]+@/, "//***:***@") ?? "none";
		logger.log(`using proxy: ${redactedProxy}`);
	} else {
		logger.warn("no proxies available, launching without proxy");
	}

	const proxyAuth = buildProxyAuth(provider);
	if (proxy && proxyAuth) {
		logger.log(
			`proxy auth enabled via PROXY_USERNAME/PROXY_PASSWORD (sessid ${proxyAuth.sessionId})`,
		);
	}

	const port = await getFreePort();
	const userDataDir = `/tmp/cdp-${provider}-${port}`;

	logger.log(`CDP browser on port ${port}${proxy ? " (proxy)" : " (direct)"}`);

	let chromeProcess: ChildProcess | null = null;
	let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;

	const cleanup = async () => {
		await browser?.close().catch(() => null);
		if (chromeProcess) await killChromiumProcess(chromeProcess);
		try {
			await rm(userDataDir, { recursive: true, force: true });
		} catch {
			// Chrome may still hold file handles briefly after kill — retry once.
			await new Promise((r) => setTimeout(r, 300));
			try {
				await rm(userDataDir, { recursive: true, force: true });
			} catch (retryErr) {
				logger.warn(
					`Failed to remove CDP profile dir ${userDataDir} (stale sweep will clean up):`,
					toErrorMessage(retryErr),
				);
			}
		}
	};

	try {
		chromeProcess = spawnChromiumCDP(port, userDataDir);
		const wsEndpoint = await waitForCDPEndpoint(port);
		browser = await chromium.connectOverCDP(wsEndpoint);

		const proxyConfig = proxy
			? {
					server: proxy,
					...(proxyAuth
						? {
								username: proxyAuth.username,
								password: proxyAuth.password,
							}
						: {}),
				}
			: undefined;

		const context = await browser.newContext({
			viewport: { width: 1920, height: 1080 },
			...(proxyConfig ? { proxy: proxyConfig } : {}),
			...STEALTH_CONTEXT_OPTIONS,
		});

		await context.addInitScript(STEALTH_INIT_SCRIPT);
		return { browser, context, proxy, cleanup };
	} catch (err) {
		if (proxy) {
			const isTimeout =
				toErrorMessage(err).toLowerCase().includes("timeout");
			recordProxyResult(
				proxy,
				false,
				isTimeout ? "timeout" : "connection_error",
				provider,
			);
			if (proxyAuth) {
				logger.warn(
					`browser launch failed; session id ${proxyAuth.sessionId} will be rotated on retry`,
				);
			}
		}
		await cleanup();
		throw new ExternalServiceError(
			"browser",
			toErrorMessage(err),
			502,
			{ provider },
			err,
		);
	}
}
