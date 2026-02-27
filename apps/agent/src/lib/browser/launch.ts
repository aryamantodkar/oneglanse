import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { logger } from "../utils/logger.js";
import { fetchProxies, getNextProxy, recordProxyResult } from "./proxy/pool.js";
import { STEALTH_CONTEXT_OPTIONS, STEALTH_INIT_SCRIPT } from "./stealth.js";
import { getFreePort, spawnChromiumCDP, waitForCDPEndpoint } from "./cdp.js";

export async function launchContext(
	provider: Provider,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	let proxy = getNextProxy();

	if (!proxy) {
		logger.warn(`[${provider}] Proxy pool exhausted, refreshing...`);
		try {
			await fetchProxies({ forceRefresh: true });
			proxy = getNextProxy();
		} catch (err) {
			logger.error(`[${provider}] Failed to refresh proxy pool:`, toErrorMessage(err));
		}
	}

	if (proxy) {
		const redactedProxy =
			proxy?.replace(/\/\/[^:]+:[^@]+@/, "//***:***@") ?? "none";
		logger.log(`Using proxy: ${redactedProxy}`);
	} else {
		logger.warn("No proxies available, launching without proxy");
	}

	const port = await getFreePort();
	const userDataDir = `/tmp/cdp-${provider}-${port}`;

	logger.log(
		`[${provider}] Starting CDP browser on port ${port}${proxy ? " (proxy)" : " (direct)"}`,
	);

	let chromProcess: ChildProcess | null = null;
	let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;

	const cleanup = async () => {
		await browser?.close().catch(() => null);
		if (chromProcess) {
			try {
				chromProcess.kill("SIGTERM");
				await new Promise((r) => setTimeout(r, 250));
				if (chromProcess.exitCode === null) {
					chromProcess.kill("SIGKILL");
				}
			} catch {
				// Process may have already exited
			}
		}
		await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
	};

	try {
		chromProcess = spawnChromiumCDP(port, userDataDir);
		const wsEndpoint = await waitForCDPEndpoint(port);
		browser = await chromium.connectOverCDP(wsEndpoint);

		const context = await browser.newContext({
			viewport: { width: 1920, height: 1080 },
			...(proxy ? { proxy: { server: proxy } } : {}),
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
