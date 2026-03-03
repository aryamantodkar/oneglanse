import { ExternalServiceError } from "@oneglanse/errors";
import { extractAIOverviewSources } from "./lib/extractSources.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import { clearEditorInput } from "../../../lib/input/editor/clearInput.js";
import { findActiveEditor } from "../../../lib/input/editor/findEditor.js";
import { logger, SELECTORS } from "@oneglanse/utils";
import { env } from "../../../env.js";
import type { ProviderConfig } from "../types.js";

// AI Overview is a search result block, not a chat interface.
// It has no streaming indicator — we wait for its container to appear instead.
const BASE_URL = "https://www.google.com/?hl=en&pws=0";
const RESPONSE_CONTAINER_SELECTORS = `${SELECTORS.aiOverviewResponse.placeholder}, ${SELECTORS.aiOverviewResponse.mainCol}`;

export const aiOverviewConfig: ProviderConfig = {
	url: BASE_URL,
	warmupDelayMs: 0,
	label: "AI Overview",
	displayName: "AI Overview",
	requiresWarmup: false,
	waitForResponse: async (page) => {
		// Wait for the AI Overview container to appear.
		// If it doesn't show up within the timeout, throw so the retry loop
		// can rotate the proxy — same failure path as every other provider.
		await page
			.locator(RESPONSE_CONTAINER_SELECTORS)
			.first()
			.waitFor({ state: "visible", timeout: env.AI_OVERVIEW_WAIT_TIMEOUT_MS })
			.catch(() => {
				throw new ExternalServiceError(
					"ai-overview",
					"AI Overview container not visible — triggering retry",
				);
			});
	},
	extractResponse: async (page) => {
		const html = await extractAIOverviewResponse(page);
		return turndown.turndown(html);
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
	checkSubmitSuccess: async (page, preSubmitUrl) => {
		// Search submits by navigation — a ?q= URL mutation is definitive success.
		const currentUrl = page.url();
		if (currentUrl !== preSubmitUrl) {
			try {
				const parsed = new URL(currentUrl);
				if (parsed.searchParams.get("q")?.trim()) return true;
			} catch {
				return true; // URL changed but unparseable — treat as success
			}
		}
		return undefined; // fall through to generic checks
	},
	postNavigationHook: async (page) => {
		// Dismiss the consent dialog if it appears.
		await page
			.locator('button:has-text("Accept all"), button#L2AGLb, [jsname="b3VHJd"]')
			.first()
			.click({ timeout: 3000 })
			.catch(() => null);
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
