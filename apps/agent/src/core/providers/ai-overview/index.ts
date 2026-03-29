import { ExternalServiceError } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { env } from "../../../env.js";
import { clickLocatorLikeUser } from "../../../lib/browser/humanBehavior.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import type { ProviderConfig } from "../types.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function assertNotBlockedPage(page: Page): void {
	const url = page.url();
	if (url.includes("/sorry/")) {
		throw new ExternalServiceError(
			"ai-overview",
			"Google bot detection triggered (sorry page) — proxy IP blocked",
			429,
		);
	}
	if (url.includes("accounts.google.com")) {
		throw new ExternalServiceError(
			"ai-overview",
			"Google redirected to login page — session cookie missing or expired",
			401,
		);
	}
}

// Google consent button IDs are locale-independent (unlike button text).
// #L2AGLb = "Accept all", #W0wltc = "Reject all"
const GOOGLE_CONSENT_SELECTOR = "button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";

// Track pages that have already completed the Google cookie warm-up so that
// subsequent prompts within the same browser session skip the extra navigation.
const warmedPages = new WeakSet<Page>();

async function dismissConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn.isVisible({ timeout: 2500 }).catch(() => false);
	if (!visible) return;

	// Consent dialog is present — click accept. If we can't, throw so the caller
	// can retry on a fresh page rather than silently proceeding without cookies.
	await clickLocatorLikeUser(page, consentBtn, { timeout: 4000 });
}

async function ensureGoogleCookies(page: Page): Promise<void> {
	if (warmedPages.has(page)) return;

	logger.log("[ai-overview] warming up Google cookies");
	await navigateWithRetry(page, "https://www.google.com/", {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	assertNotBlockedPage(page);
	await dismissConsentDialog(page);
	warmedPages.add(page);
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	warmupDelayMs: 0,
	label: "AI Overview",
	displayName: "AI Overview",
	requiresWarmup: false,
	// beforePromptHook handles Google cookie warmup and consent before askPrompt
	// takes over the standard type-and-submit flow.
	beforePromptHook: async (page) => {
		await ensureGoogleCookies(page);
		assertNotBlockedPage(page);
	},
	// After submit, dismiss any consent dialog that appeared on search results,
	// then verify we landed on a search results page.
	afterSubmitHook: async (page) => {
		await dismissConsentDialog(page).catch(() => {});
	},
	checkSubmitSuccess: async (page, { preSubmitUrl }) => {
		// Give the page up to 5s to navigate to search results.
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline) {
			const url = await page.getUrl().catch(() => page.url());
			if (url.includes("google.com/search")) return true;
			await page.waitForTimeout(100);
		}
		// If we're still on the same URL, submission didn't navigate.
		const currentUrl = await page.getUrl().catch(() => page.url());
		return currentUrl !== preSubmitUrl;
	},
	waitForResponse: async (page) => {
		await page
			.waitForSelector(
				'[data-container-id="model-response-placeholder"], [data-container-id="main-col"]',
				{ timeout: env.AI_OVERVIEW_WAIT_TIMEOUT_MS },
			)
			.catch(() => {});

		// Guard: if we're not on a search results page, extraction will produce garbage.
		if (!page.url().includes("google.com/search")) {
			throw new ExternalServiceError(
				"ai-overview",
				"Not on search results page when response wait completed",
			);
		}
	},
	extractResponse: async (page) => {
		const html = await extractAIOverviewResponse(page);
		return turndown.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
	},
	betweenPromptsHook: async (page) => {
		// After a search, the page is on google.com/search — the search box is still
		// present so askPrompt can clear and reuse it directly for the next prompt.
		// Brief pause to avoid query-bursting patterns.
		await page.waitForTimeout(randomBetween(2000, 4000));
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
