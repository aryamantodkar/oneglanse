import { extractAIOverviewSources } from "./lib/extractSources.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import { clearEditorInput } from "../../../lib/input/editor/clearInput.js";
import { findActiveEditor } from "../../../lib/input/editor/findEditor.js";
import { logger } from "@oneglanse/utils";
import { env } from "../../../env.js";
import type { ProviderConfig } from "../types.js";

const BASE_URL = "https://www.google.com/?hl=en&pws=0";

export const aiOverviewConfig: ProviderConfig = {
	url: BASE_URL,
	warmupDelayMs: 0,
	label: "AI Overview",
	displayName: "AI Overview",
	requiresWarmup: false,
	waitForResponse: async (page) => {
		// Poll for the AI Overview container — resolves as soon as it appears rather
		// than sleeping a flat 10s. Falls through on timeout so extraction can report
		// the missing element cleanly.
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
	beforeSubmitHook: async (page) => {
		// Google's autocomplete captures the first Enter (selects suggestion instead of
		// submitting). Press Escape to dismiss the dropdown so Enter goes to form submission.
		await page.keyboard.press("Escape");
		await page.waitForTimeout(150);
	},
	beforeRetryHook: async (page) => {
		const input = await findActiveEditor(page, "ai-overview").catch(() => null);
		const cleared = input
			? await clearEditorInput(page, input, { dismissWithEscape: true })
			: false;
		if (cleared) {
			logger.debug("[ai-overview] Cleared search input before retry");
			return;
		}

		logger.debug("[ai-overview] Could not clear input; navigating to base URL before retry");
		await navigateWithRetry(page, BASE_URL, {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});
	},
	betweenPromptsHook: async (page) => {
		const input = await findActiveEditor(page, "ai-overview").catch(() => null);
		const cleared = input
			? await clearEditorInput(page, input, { dismissWithEscape: true })
			: false;
		if (cleared) {
			logger.debug("[ai-overview] Cleared search input between prompts");
			await page.waitForTimeout(400);
			return;
		}

		// Fallback: navigate back to the base search page so the next prompt starts clean.
		await navigateWithRetry(page, BASE_URL, {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});
		await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
	},
	checkSubmitSuccess: async (page) => {
		// Poll up to 3s for the URL to land on /search?q=... — navigation takes
		// variable time and 800ms (the generic wait) is often not enough for Google.
		// Any other outcome (autocomplete nav, sorry page, no change) is a failure
		// so the caller falls through to the next submission method.
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			try {
				const parsed = new URL(page.url());
				if (parsed.pathname === "/search" && parsed.searchParams.get("q")?.trim()) {
					return true;
				}
			} catch {
				// unparseable URL — not a search result page
			}
			await page.waitForTimeout(200);
		}
		return false;
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
