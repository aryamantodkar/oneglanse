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
import { clearEditorInput } from "../../../lib/input/editor/clearInput.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import type { ProviderConfig } from "../types.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

// Fallback only — used when the search box cannot be found on the page.
// Typing via the search box is strongly preferred as it produces organic
// oq= / gs_lcrp parameters that a direct URL navigation never has.
function buildFallbackSearchUrl(prompt: string): string {
	return `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
}

// Join all editor selectors so the first visible one is matched
const GOOGLE_SEARCH_INPUT = PROVIDER_EDITOR_SELECTORS["ai-overview"].join(", ");

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
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		await ensureGoogleCookies(page);

		// Prefer typing in the search box: produces organic oq= parameter,
		// triggers real autocomplete requests, and creates the click→type→submit
		// pattern that distinguishes human sessions from direct URL navigation.
		const searchInput = page.locator(GOOGLE_SEARCH_INPUT).first();
		const inputVisible = await searchInput
			.isVisible({ timeout: 5000 })
			.catch(() => false);

			if (inputVisible) {
				await moveMouseToElement(page, searchInput);
				await searchInput.click();
				await page.waitForTimeout(randomBetween(300, 700));
				// Clear any existing SERP query using the browser-appropriate modifier
				// first, while keeping the current Control/setInputValue fallbacks.
				await clearEditorInput(page, searchInput, {
					waitAfterMs: randomBetween(80, 180),
				}).catch(() => false);
				await humanType(page, prompt);
				await page.waitForTimeout(randomBetween(400, 900));
				await page.keyboard.press("Enter");
				await page.waitForLoadState("domcontentloaded").catch(() => {});
		} else {
			// Fallback: search box not found — navigate directly
			logger.log("[ai-overview] search box not found, falling back to direct URL");
			await navigateWithRetry(page, buildFallbackSearchUrl(prompt), {
				waitUntil: "domcontentloaded",
				timeout: 30000,
			});
		}

		assertNotBlockedPage(page);
		await dismissConsentDialog(page);
		logger.log(`[ai-overview] search ready: ${page.url()}`);
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
		// Brief pause before the next search; reading time is already implicit in the
		// response wait above. 2-4s is sufficient to avoid query-bursting patterns.
		await _page.waitForTimeout(randomBetween(2000, 4000));
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
