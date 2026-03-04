import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { logger } from "@oneglanse/utils";
import { env } from "../../env.js";
import { getFreePort, killChromiumProcess, spawnSeleniumBaseCDP, waitForCDPEndpoint } from "./cdp.js";
import { STEALTH_CONTEXT_OPTIONS, STEALTH_INIT_SCRIPT } from "./stealth.js";

function redactProxy(proxy: string): string {
	return proxy.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, "//***:***@");
}

type ProxyConfig = {
	logProxy: string;
	seleniumBaseProxy: string;
};

const MAX_CONCURRENT_BROWSER_LAUNCHES = 2;
let activeLaunches = 0;
const launchQueue: Array<() => void> = [];

async function acquireLaunchSlot(): Promise<void> {
	if (activeLaunches < MAX_CONCURRENT_BROWSER_LAUNCHES) {
		activeLaunches++;
		return;
	}

	await new Promise<void>((resolve) => {
		launchQueue.push(() => {
			activeLaunches++;
			resolve();
		});
	});
}

function releaseLaunchSlot(): void {
	if (activeLaunches > 0) activeLaunches--;
	const next = launchQueue.shift();
	if (next) next();
}

function buildProxyConfig(): ProxyConfig | null {
	const host = env.PROXY_HOST?.trim();
	const port = env.PROXY_PORT?.trim();
	if (!host || !port) return null;

	const username = env.PROXY_USERNAME?.trim();
	const password = env.PROXY_PASSWORD?.trim();
	const hostPart =
		host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

	if (!username || !password) {
		return {
			logProxy: `http://${hostPart}:${port}`,
			seleniumBaseProxy: `${hostPart}:${port}`,
		};
	}

	const encodedUsername = encodeURIComponent(username);
	const encodedPassword = encodeURIComponent(password);
	return {
		logProxy: `http://${encodedUsername}:${encodedPassword}@${hostPart}:${port}`,
		seleniumBaseProxy: `${username}:${password}@${hostPart}:${port}`,
	};
}

export async function launchContext(
	provider: Provider,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	const proxyConfig = buildProxyConfig();
	const logProxy = proxyConfig?.logProxy ?? null;
	const launchProxy = proxyConfig?.seleniumBaseProxy ?? null;

	if (logProxy) {
		logger.log(`using proxy: ${redactProxy(logProxy)}`);
	} else {
		logger.warn("no proxies available, launching without proxy");
	}

	logger.log(
		`launching seleniumbase chromium via CDP${launchProxy ? " (proxy)" : " (direct)"}`,
	);

	let browser: Browser | null = null;
	let chromiumProcess: ChildProcess | null = null;
	let userDataDir: string | null = null;
	let launchSlotHeld = false;

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
		await acquireLaunchSlot();
		launchSlotHeld = true;
		userDataDir = await mkdtemp(path.join(tmpdir(), `onescope-agent-${provider}-`));

		const cdpPort = await getFreePort();
		chromiumProcess = spawnSeleniumBaseCDP(
			cdpPort,
			userDataDir,
			launchProxy ?? undefined,
		);
		const processLogs: string[] = [];
		const appendProcessLog = (chunk: Buffer) => {
			const text = chunk.toString("utf8").trim();
			if (!text) return;
			processLogs.push(text);
			if (processLogs.length > 12) processLogs.shift();
		};
		chromiumProcess.stdout?.on("data", appendProcessLog);
		chromiumProcess.stderr?.on("data", (chunk: Buffer) => {
			appendProcessLog(chunk);
			process.stderr.write(chunk);
		});

		const cdpEndpoint = await waitForCDPEndpoint(cdpPort, {
			timeoutMs: 45_000,
			process: chromiumProcess,
			getProcessLogs: () => processLogs.join(" | "),
		});
		browser = await chromium.connectOverCDP(cdpEndpoint);

		// With SeleniumBase-authenticated proxies, reuse the default CDP context.
		// Creating a new context can bypass SeleniumBase's proxy-auth handling.
		const existingContext = browser.contexts()[0];
		const context =
			existingContext ??
			(await browser.newContext({
				viewport: { width: 1920, height: 1080 },
				...STEALTH_CONTEXT_OPTIONS,
			}));
		await context
			.setExtraHTTPHeaders(STEALTH_CONTEXT_OPTIONS.extraHTTPHeaders)
			.catch(() => null);

		await context.addInitScript(STEALTH_INIT_SCRIPT);
		return { browser, context, proxy: logProxy, cleanup };
	} catch (err) {
		await cleanup();
		throw new ExternalServiceError(
			"browser",
			toErrorMessage(err),
			502,
			{ provider },
			err,
		);
	} finally {
		if (launchSlotHeld) {
			releaseLaunchSlot();
		}
	}
}
