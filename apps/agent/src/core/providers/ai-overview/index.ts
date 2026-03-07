import { ExternalServiceError } from "@oneglanse/errors";
import { extractAIOverviewSources } from "./lib/extractSources.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import { logger } from "@oneglanse/utils";
import { env } from "../../../env.js";
import type { Page } from "playwright";
import type { ProviderConfig } from "../types.js";

function buildSearchUrl(prompt: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(prompt)}&hl=en&pws=0`;
}

function assertNotSorryPage(page: Page): void {
	if (page.url().includes("/sorry/")) {
		throw new ExternalServiceError(
			"ai-overview",
			"Google bot detection triggered (sorry page) — proxy IP blocked",
			429,
		);
	}
}

// Track pages that have already completed the Google cookie warm-up so that
// subsequent prompts within the same browser session skip the extra navigation.
const warmedPages = new WeakSet<Page>();

async function ensureGoogleCookies(page: Page): Promise<void> {
	if (warmedPages.has(page)) return;

	logger.log("[ai-overview] warming up Google cookies");
	await navigateWithRetry(page, "https://www.google.com/?hl=en&pws=0", {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	assertNotSorryPage(page);
	await page
		.locator('button:has-text("Accept all")')
		.first()
		.click({ timeout: 3000 })
		.catch(() => null);
	warmedPages.add(page);
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/?hl=en&pws=0",
	warmupDelayMs: 0,
	label: "AI Overview",
	displayName: "AI Overview",
	requiresWarmup: false,
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		await ensureGoogleCookies(page);
		const url = buildSearchUrl(prompt);
		logger.log(`[ai-overview] navigating to ${url}`);
		await navigateWithRetry(page, url, {
			waitUntil: "domcontentloaded",
			timeout: 60000,
		});
		assertNotSorryPage(page);
		// Dismiss consent dialog if it re-appears on the search result page
		await page
			.locator('button:has-text("Accept all")')
			.first()
			.click({ timeout: 3000 })
			.catch(() => null);
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
	betweenPromptsHook: async (_page) => {
		// Each prompt navigates to its own URL via navigateToPrompt — nothing to reset.
		// Real users take 8-20s between consecutive searches (reading results, deciding).
		const pause = 8000 + Math.floor(Math.random() * 12000);
		await _page.waitForTimeout(pause);
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
