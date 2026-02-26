import type { Provider } from "@onescope/types";
import { chromium as playwrightChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { logger } from "../utils/logger.js";
import { fetchProxies, getNextProxy } from "./proxy/pool.js";
import {
	STEALTH_CHROME_ARGS,
	STEALTH_CONTEXT_OPTIONS,
	STEALTH_INIT_SCRIPT,
} from "./stealth.js";

playwrightChromium.use(StealthPlugin());

export async function launchContext(provider: Provider) {
	let proxy = getNextProxy();

	if (!proxy) {
		logger.warn(`[${provider}] Proxy pool exhausted, refreshing...`);
		try {
			await fetchProxies({ forceRefresh: true });
			proxy = getNextProxy();
		} catch (err: any) {
			logger.error(`[${provider}] Failed to refresh proxy pool:`, err?.message);
		}
	}

	if (proxy) {
		const redactedProxy =
			proxy?.replace(/\/\/[^:]+:[^@]+@/, "//***:***@") ?? "none";
		logger.log(`Using proxy: ${redactedProxy}`);
	} else {
		logger.warn("No proxies available, launching without proxy");
	}

	const browser = await playwrightChromium.launch({
		headless: true,
		proxy: proxy ? { server: proxy } : undefined,
		args: [
			"--disable-blink-features=AutomationControlled",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			...STEALTH_CHROME_ARGS,
		],
	});

	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
		...STEALTH_CONTEXT_OPTIONS,
	});

	await context.addInitScript(STEALTH_INIT_SCRIPT);

	return { browser, context, proxy };
}
