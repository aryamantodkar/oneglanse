import { extractAIOverviewSources } from "./lib/extractSources.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import { logger } from "@oneglanse/utils";
import { env } from "../../../env.js";
import type { ProviderConfig } from "../types.js";

const BASE_URL = "https://www.google.com/?hl=en&pws=0";

function buildSearchUrl(prompt: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(prompt)}&hl=en&pws=0`;
}

export const aiOverviewConfig: ProviderConfig = {
	url: BASE_URL,
	warmupDelayMs: 0,
	label: "AI Overview",
	displayName: "AI Overview",
	requiresWarmup: false,
	navigateToPrompt: async (page, prompt) => {
		const url = buildSearchUrl(prompt);
		logger.log(`[ai-overview] navigating to search URL: ${url}`);
		await navigateWithRetry(page, url, {
			waitUntil: "domcontentloaded",
			timeout: 60000,
		});
		logger.log(`[ai-overview] search page ready: ${page.url()}`);
	},
	waitForResponse: async (page) => {
		await page
			.waitForSelector(
				'[data-container-id="model-response-placeholder"], [data-container-id="main-col"]',
				{ timeout: env.AI_OVERVIEW_WAIT_TIMEOUT_MS },
			)
			.catch(() => {});
	},
	extractResponse: async (page) => {
		const html = await extractAIOverviewResponse(page);
		return turndown.turndown(html);
	},
	betweenPromptsHook: async (page) => {
		// Each prompt navigates to its own search URL, so nothing to reset.
		// Small pause to avoid hammering Google between requests.
		await page.waitForTimeout(1000);
	},
	postNavigationHook: async (page) => {
		// Dismiss the consent dialog if it appears.
		await page
			.locator('button:has-text("Accept all")')
			.first()
			.click({ timeout: 3000 })
			.catch(() => null);
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
