import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { logger } from "@oneglanse/utils";
import { fetchProxies, getNextProxy, recordProxyResult } from "./proxy/pool.js";
import { getFreePort, killChromiumProcess, spawnSeleniumBaseCDP, waitForCDPEndpoint } from "./cdp.js";
import { STEALTH_CONTEXT_OPTIONS, STEALTH_INIT_SCRIPT } from "./stealth.js";

function redactProxy(proxy: string): string {
	return proxy.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, "//***:***@");
}

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
		logger.warn(`proxy pool exhausted, refreshing...`);
		try {
			await fetchProxies({ forceRefresh: true });
			proxy = getNextProxy();
		} catch (err) {
			logger.error(`failed to refresh proxy pool:`, toErrorMessage(err));
		}
	}

	if (proxy) {
		logger.log(`using proxy: ${redactProxy(proxy)}`);
	} else {
		logger.warn("no proxies available, launching without proxy");
	}

	logger.log(`launching seleniumbase chromium via CDP${proxy ? " (proxy)" : " (direct)"}`);

	let browser: Browser | null = null;
	let chromiumProcess: ChildProcess | null = null;
	let userDataDir: string | null = null;

	const cleanup = async () => {
		await browser?.close().catch(() => null);
		if (chromiumProcess) {
			await killChromiumProcess(chromiumProcess).catch(() => null);
		}
		if (userDataDir) {
			await rm(userDataDir, { recursive: true, force: true }).catch(() => null);
		}
	};

	try {
		userDataDir = await mkdtemp(path.join(tmpdir(), `onescope-agent-${provider}-`));

		const cdpPort = await getFreePort();
		chromiumProcess = spawnSeleniumBaseCDP(cdpPort, userDataDir, proxy ?? undefined);
		const processLogs: string[] = [];
		const appendProcessLog = (chunk: Buffer) => {
			const text = chunk.toString("utf8").trim();
			if (!text) return;
			processLogs.push(text);
			if (processLogs.length > 12) processLogs.shift();
		};
		chromiumProcess.stdout?.on("data", appendProcessLog);
		chromiumProcess.stderr?.on("data", appendProcessLog);

		const cdpEndpoint = await waitForCDPEndpoint(cdpPort, {
			process: chromiumProcess,
			getProcessLogs: () => processLogs.join(" | "),
		});
		browser = await chromium.connectOverCDP(cdpEndpoint);

		let context: BrowserContext;
		try {
			context = await browser.newContext({
				viewport: { width: 1920, height: 1080 },
				...STEALTH_CONTEXT_OPTIONS,
			});
		} catch {
			const existingContext = browser.contexts()[0];
			if (!existingContext) {
				throw new ExternalServiceError("browser", "No browser context available after CDP attach");
			}
			context = existingContext;
			await context
				.setExtraHTTPHeaders(STEALTH_CONTEXT_OPTIONS.extraHTTPHeaders)
				.catch(() => null);
		}

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
