import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { launchContext } from "../../lib/browser/launch.js";
import { navigateWithRetry } from "../../lib/browser/navigate.js";
import { logger } from "../../lib/utils/logger.js";
import { AGENT_PROVIDER_CONFIG } from "./providerRegistry.js";

export async function createAgent(provider: Provider) {
	const config = AGENT_PROVIDER_CONFIG[provider];

	const { browser, context, proxy } = await launchContext(provider);
	const page = await context.newPage();

	if (config.preNavigationHook) {
		await config.preNavigationHook(page);
	}

	logger.log(`📍 Navigating to ${config.entryUrl}`);
	await navigateWithRetry(page, config.entryUrl, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	});

	if (config.postNavigationHook) {
		await config.postNavigationHook(page);
	}

	logger.log("Loaded url:", page.url());

	page.setDefaultTimeout(0);
	page.setDefaultNavigationTimeout(0);

	page.on("console", (_msg) => {
		// console.log(`[${provider.toUpperCase()} PAGE]`, _msg.text())
	});

	await page.waitForTimeout(config.warmupDelayMs);

	const auth = await isAuthenticated(page, provider);

	return { browser, context, page, auth, proxy };
}
