import { ExternalServiceError } from "@oneglanse/errors";
import { PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import {
	findActiveEditorCandidateFromSelectors,
} from "../../../lib/input/editor/findEditor.js";
import { insertPromptIntoEditor } from "../../../lib/input/editor/promptInput.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";
import type { ProviderConfig } from "../types.js";

const GOOGLE_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";
const SEARCH_RESULTS_WAIT_MS = 8_000;

const warmedPages = new WeakSet<Page>();

async function dismissConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn.isVisible({ timeout: 2500 }).catch(() => false);
	if (!visible) return;

	await consentBtn.click({ timeout: 4000 }).catch(() => {});
	await page.waitForTimeout(1000);
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

async function waitForSearchResults(page: Page): Promise<void> {
	const deadline = Date.now() + SEARCH_RESULTS_WAIT_MS;

	while (Date.now() < deadline) {
		const url = page.url();
		if (url.includes("/search?")) {
			return;
		}

		assertNotBlockedPage(page);
		await page.waitForTimeout(150);
	}

	throw new ExternalServiceError(
		"ai-overview",
		`Not on search results page after submission (url: ${page.url()})`,
	);
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	label: "AI Overview",
	displayName: "AI Overview",
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		await ensureGoogleCookies(page);

		if (!page.url().startsWith("https://www.google.com/")) {
			await navigateWithRetry(page, "https://www.google.com/", {
				waitUntil: "domcontentloaded",
				timeout: 30000,
			});
		}

		assertNotBlockedPage(page);
		await dismissConsentDialog(page);

		const searchInput = await findActiveEditorCandidateFromSelectors(page, [
			...PROVIDER_EDITOR_SELECTORS["ai-overview"],
		]);
		logger.debug(`[ai-overview] using search selector: ${searchInput.selector}`);

		logger.debug(`[ai-overview] pasting ${prompt.length} chars…`);
		await insertPromptIntoEditor(
			page,
			searchInput.locator,
			prompt,
			"ai-overview",
		);
		logger.debug(`[ai-overview] pasting ${prompt.length} chars complete`);
		await page.waitForTimeout(400);

		logger.debug("[ai-overview] attempting submission…");
		await page.keyboard.press("Enter");
		await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(
			() => {},
		);
		await waitForSearchResults(page);
		await dismissConsentDialog(page);
		assertNotBlockedPage(page);
		logger.log(`[ai-overview] search ready: ${page.url()}`);
	},
	waitForResponse: async (page) => {
		await page
			.waitForSelector(
				'[data-container-id="model-response-placeholder"], [data-container-id="main-col"]',
				{ timeout: 25000 },
			)
			.catch(() => {});
	},
	extractResponse: async (page) => {
		const html = await extractAIOverviewResponse(page);
		return turndown.turndown(html);
	},
	betweenPromptsHook: async (page) => {
		await page.waitForTimeout(8000 + Math.floor(Math.random() * 12000));
	},
	extractSources: (page) => extractAIOverviewSources(page),
};
