import { ExternalServiceError } from "@oneglanse/errors";
import { PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { env } from "../../../env.js";
import {
	clickLocatorLikeUser,
	humanType,
	moveMouseToElement,
} from "../../../lib/browser/humanBehavior.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import type { ProviderConfig } from "../types.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function buildFallbackSearchUrl(prompt: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
}

const GOOGLE_SEARCH_INPUT = PROVIDER_EDITOR_SELECTORS["ai-overview"].join(", ");

const GOOGLE_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";

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

async function dismissConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn.isVisible({ timeout: 2500 }).catch(() => false);
	if (!visible) return;
	await clickLocatorLikeUser(page, consentBtn, { timeout: 4000 });
}

// Track pages that have already established Google cookies so the first
// prompt skips the extra google.com navigation.
const warmedPages = new WeakSet<Page>();

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

async function navigateToGoogleHome(page: Page): Promise<void> {
	await navigateWithRetry(page, "https://www.google.com/", {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	assertNotBlockedPage(page);
	await dismissConsentDialog(page);
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	warmupDelayMs: 0,
	label: "AI Overview",
	displayName: "AI Overview",
	requiresWarmup: false,
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		// First prompt: ensure Google cookies are established via google.com visit.
		// Subsequent prompts: session is reused (warmedPages check is a no-op).
		await ensureGoogleCookies(page);

		// Try the search box on the current page (google.com homepage or SERP).
		// Reusing the SERP avoids extra navigation on prompt 2+.
		let searchInput = page.locator(GOOGLE_SEARCH_INPUT).first();
		let inputVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

		if (!inputVisible) {
			// Search box gone (e.g. SERP state changed) — navigate back to google.com
			// homepage before falling back to direct URL. Homepage is more reliable
			// and avoids the block-prone direct-URL pattern.
			logger.log("[ai-overview] search box not found, returning to google.com homepage");
			await navigateToGoogleHome(page);
			searchInput = page.locator(GOOGLE_SEARCH_INPUT).first();
			inputVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
		}

		if (inputVisible) {
			await moveMouseToElement(page, searchInput);
			await searchInput.click();
			await page.waitForTimeout(randomBetween(300, 700));
			// Select any existing query (e.g. previous search on SERP) then type to replace
			await page.keyboard.press("Control+a");
			await humanType(page, prompt);
			// Verify the input received the full prompt before submitting
			const inputContent = await searchInput.readInputValue().catch(() => "");
			if (inputContent.trim().length < prompt.trim().length * 0.9) {
				throw new ExternalServiceError(
					"ai-overview",
					`Typing failed: input length ${inputContent.trim().length} is less than 90% of prompt length ${prompt.trim().length}`,
				);
			}
			await page.waitForTimeout(randomBetween(400, 900));
			await page.keyboard.press("Enter");
			await page.waitForLoadState("domcontentloaded").catch(() => {});
		} else {
			// Last resort: direct URL — more block-prone but prevents a total failure.
			logger.log("[ai-overview] search box still not found, falling back to direct URL");
			await navigateWithRetry(page, buildFallbackSearchUrl(prompt), {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});
		}

		assertNotBlockedPage(page);
		await dismissConsentDialog(page);
		logger.log(`[ai-overview] search ready: ${page.url()}`);
	},
	waitForResponse: async (page) => {
		// Guard: check for bot detection before waiting on response selectors.
		const url = page.url();
		if (url.includes("/sorry/")) {
			throw new ExternalServiceError(
				"ai-overview",
				"Google bot detection triggered (sorry page) — proxy IP blocked",
				429,
			);
		}

		// Must be on a real search results page before waiting for AI Overview.
		if (!url.includes("google.com/search")) {
			throw new ExternalServiceError(
				"ai-overview",
				`Not on search results page after submission (url: ${url})`,
			);
		}

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
	extractSources: (page) => extractAIOverviewSources(page),
};
