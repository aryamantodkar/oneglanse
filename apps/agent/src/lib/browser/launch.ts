import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { existsSync } from "node:fs";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "@oneglanse/utils";
import { env } from "../../env.js";
import {
	STEALTH_CHROME_ARGS,
	STEALTH_CONTEXT_OPTIONS,
	STEALTH_INIT_SCRIPT,
} from "./stealth.js";

chromium.use(StealthPlugin());

function redactProxy(proxy: string): string {
	return proxy.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, "//***:***@");
}

type ProxyConfig = {
	logProxy: string;
	playwrightProxy: NonNullable<Parameters<typeof chromium.launch>[0]>["proxy"];
};

const MAX_CONCURRENT_BROWSER_LAUNCHES = 1;
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
	const server = `http://${hostPart}:${port}`;

	if (!username || !password) {
		return {
			logProxy: server,
			playwrightProxy: { server },
		};
	}

	const encodedUsername = encodeURIComponent(username);
	const encodedPassword = encodeURIComponent(password);
	return {
		logProxy: `http://${encodedUsername}:${encodedPassword}@${hostPart}:${port}`,
		playwrightProxy: {
			server,
			username,
			password,
		},
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

	if (logProxy) {
		logger.log(`using proxy: ${redactProxy(logProxy)}`);
	} else {
		logger.warn("no proxies available, launching without proxy");
	}

	logger.log(
		`launching chromium${proxyConfig ? " (proxy)" : " (direct)"}`,
	);

	let browser: Browser | null = null;
	let launchSlotHeld = false;

	const cleanup = async () => {
		await browser?.close().catch(() => null);
	};

	try {
		await acquireLaunchSlot();
		launchSlotHeld = true;
		const launchOptions: Parameters<typeof chromium.launch>[0] = {
			headless: true,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-blink-features=AutomationControlled",
				...STEALTH_CHROME_ARGS,
			],
			...(proxyConfig ? { proxy: proxyConfig.playwrightProxy } : {}),
		};
		if (existsSync("/usr/bin/chromium")) {
			launchOptions.executablePath = "/usr/bin/chromium";
		}

		browser = await chromium.launch(launchOptions);

		const context = await browser.newContext({
			viewport: { width: 1920, height: 1080 },
			...STEALTH_CONTEXT_OPTIONS,
		});

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
