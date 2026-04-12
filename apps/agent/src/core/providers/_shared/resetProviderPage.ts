import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { preInteractionIdle, randomBetween } from "../../../lib/browser/humanBehavior.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { detectBotPage } from "../../../lib/input/response/detectBotPage.js";

type ResetProviderPageOptions = {
	postNavigationHook?: (page: Page) => Promise<void>;
};

export async function resetProviderPage(
	page: Page,
	provider: Provider,
	url: string,
	options: ResetProviderPageOptions = {},
): Promise<void> {
	logger.log(`[${provider}] resetting page for next prompt`);

	await preInteractionIdle(page).catch(() => {});
	await page.waitForTimeout(randomBetween(600, 1400));

	await navigateWithRetry(page, url, {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	logger.log(`[${provider}] redirected back to provider page: ${page.url()}`);

	await detectBotPage(page, provider);
	await options.postNavigationHook?.(page);
	await page.waitForTimeout(randomBetween(1200, 2600));

	logger.log(`[${provider}] page reset ready: ${page.url()}`);
}
