import { ExternalServiceError } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { insertPromptIntoEditor } from "../../../lib/input/editor/promptInput.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import {
	requireEditorCandidate,
	waitForSelectorProfile,
} from "../../../lib/selectors/index.js";
import type { ProviderConfig } from "../types.js";

const GOOGLE_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";
const SEARCH_RESULTS_WAIT_MS = 8_000;
// How long to wait for the LLM selector profile to resolve a response element.
// If no response selector resolves in this window, there is no AI Overview.
const AI_OVERVIEW_PROBE_TIMEOUT_MS = 8_000;

const warmedPages = new WeakSet<Page>();

async function dismissConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn
		.isVisible({ timeout: 2500 })
		.catch(() => false);
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

	logger.log("warming up Google cookies");
	await navigateWithRetry(page, "https://www.google.com/", {
		waitUntil: "domcontentloaded",
		timeout: 30000,
	});
	assertNotBlockedPage(page);
	await dismissConsentDialog(page);
	warmedPages.add(page);
}

function normalizeGoogleQuery(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

async function waitForSearchResults(
	page: Page,
	expectedQuery: string,
): Promise<void> {
	const deadline = Date.now() + SEARCH_RESULTS_WAIT_MS;
	const normalizedExpectedQuery = normalizeGoogleQuery(expectedQuery);

	while (Date.now() < deadline) {
		const rawUrl = page.url();
		try {
			const url = new URL(rawUrl);
			const isGoogleSearchResults =
				url.hostname.endsWith("google.com") && url.pathname === "/search";
			const currentQuery = normalizeGoogleQuery(
				url.searchParams.get("q") ?? "",
			);
			if (
				isGoogleSearchResults &&
				currentQuery.length > 0 &&
				currentQuery === normalizedExpectedQuery
			) {
				return;
			}
		} catch {}

		assertNotBlockedPage(page);
		await page.waitForTimeout(150);
	}

	throw new ExternalServiceError(
		"ai-overview",
		`Not on search results page after submission (url: ${page.url()})`,
	);
}

function isGoogleHomePage(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return url.hostname === "www.google.com" && url.pathname === "/";
	} catch {
		return false;
	}
}

async function assertAiOverviewPresent(page: Page): Promise<void> {
	// Ask the selector profile to resolve a response element. If the LLM finds
	// no response container within the probe window, there is no AI Overview block
	// and we fail fast rather than waiting 45s for a response that never arrives.
	const profile = await waitForSelectorProfile(
		page,
		"ai-overview",
		"response",
		AI_OVERVIEW_PROBE_TIMEOUT_MS,
	).catch(() => null);
	if (!profile?.selectors.response.length) {
		throw new ExternalServiceError(
			"ai-overview",
			"AI Overview block not present in search results — query may not trigger an AI Overview for this prompt",
			204,
		);
	}
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	label: "AI Overview",
	displayName: "AI Overview",
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		await ensureGoogleCookies(page);

		if (!isGoogleHomePage(page.url())) {
			await navigateWithRetry(page, "https://www.google.com/", {
				waitUntil: "domcontentloaded",
				timeout: 30000,
			});
		}

		assertNotBlockedPage(page);
		await dismissConsentDialog(page);

		const searchInput = await requireEditorCandidate(page, "ai-overview");
		logger.log(`using search selector: ${searchInput.selector}`);

		logger.debug(`pasting ${prompt.length} chars…`);
		await insertPromptIntoEditor(
			page,
			searchInput.locator,
			prompt,
			"ai-overview",
		);
		logger.debug(`pasting ${prompt.length} chars complete`);
		await page.waitForTimeout(400);

		logger.debug("attempting submission…");
		await page.keyboard.press("Enter");
		await page
			.waitForLoadState("domcontentloaded", { timeout: 5000 })
			.catch(() => {});
		await waitForSearchResults(page, prompt);
		await dismissConsentDialog(page);
		assertNotBlockedPage(page);
		await assertAiOverviewPresent(page);
		logger.log(`search ready: ${page.url()}`);
	},
	waitForResponse: (page) => waitForAssistantToFinish(page, "ai-overview"),
	extractResponse: (page) => extractAssistantMarkdown(page, "ai-overview"),
	betweenPromptsHook: async (page) => {
		await page.waitForTimeout(8000 + Math.floor(Math.random() * 12000));
	},
};
