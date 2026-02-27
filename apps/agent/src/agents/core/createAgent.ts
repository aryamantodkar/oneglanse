import type { Provider } from "@oneglanse/types";
import type { Browser, BrowserContext, ConsoleMessage, Page } from "playwright";
import { env } from "../../env.js";
import { launchContext } from "../../lib/browser/launch.js";
import { navigateWithRetry } from "../../lib/browser/navigate.js";
import { logger } from "../../lib/utils/logger.js";
import { withTimeout } from "../../lib/utils/withTimeout.js";
import { AGENT_PROVIDER_CONFIG } from "./providerRegistry.js";

const DEFAULT_PAGE_TIMEOUT_MS = env.PAGE_DEFAULT_TIMEOUT_MS;
const DEFAULT_NAV_TIMEOUT_MS = env.PAGE_DEFAULT_NAVIGATION_TIMEOUT_MS;
const HOOK_TIMEOUT_MS = env.PROVIDER_HOOK_TIMEOUT_MS;

export async function createAgent(
	provider: Provider,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	const config = AGENT_PROVIDER_CONFIG[provider];

	const { browser, context, proxy, cleanup } = await launchContext(provider);
	const page = await context.newPage();

	if (config.preNavigationHook) {
		await withTimeout(
			`[${provider}] preNavigationHook`,
			async () => config.preNavigationHook!(page),
			HOOK_TIMEOUT_MS,
		);
	}

	logger.log(`📍 Navigating to ${config.url}`);
	await navigateWithRetry(page, config.url, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	});

	if (config.postNavigationHook) {
		await withTimeout(
			`[${provider}] postNavigationHook`,
			async () => config.postNavigationHook!(page),
			HOOK_TIMEOUT_MS,
		);
	}

	logger.log("Loaded url:", page.url());

	// Keep finite defaults to prevent indefinite hangs in locator/actions.
	// Long-running response generation is handled separately via explicit waits.
	page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);
	page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);

	page.on("console", (_msg: ConsoleMessage) => {
		// console.log(`[${provider.toUpperCase()} PAGE]`, _msg.text())
	});

	await page.waitForTimeout(config.warmupDelayMs);

	return { browser, context, page, proxy, cleanup };
}
