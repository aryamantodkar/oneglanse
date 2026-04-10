import { ExternalServiceError } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import { insertPromptIntoEditor } from "../../../lib/input/editor/promptInput.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import { requireEditorCandidate } from "../../../lib/selectors/index.js";
import { GOOGLE_CONSENT_SELECTOR } from "../_shared/google.js";
import type { ProviderConfig } from "../types.js";
import {
	extractAiOverviewFallbackHtml,
	extractAiOverviewFallbackText,
	prepareAiOverviewViewport,
	readAiOverviewSignals,
} from "./dom.js";
const SEARCH_RESULTS_WAIT_MS = 8_000;
const AI_OVERVIEW_SETTLE_TIMEOUT_MS = 5_000;
const AI_OVERVIEW_SETTLE_POLL_MS = 250;
const AI_OVERVIEW_STABLE_POLLS_REQUIRED = 3;

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
	await prepareAiOverviewViewport(page);
	const visibleSignals = await readAiOverviewSignals(page);
	if (visibleSignals.found) {
		return;
	}

	throw new ExternalServiceError(
		"ai-overview",
		"AI Overview block not present in search results — query may not trigger an AI Overview for this prompt",
		204,
	);
}

async function waitForAiOverviewReady(page: Page): Promise<void> {
	await prepareAiOverviewViewport(page);
	const deadline = Date.now() + AI_OVERVIEW_SETTLE_TIMEOUT_MS;
	let lastText = "";
	let stablePolls = 0;

	while (Date.now() < deadline) {
		const text =
			(await extractAiOverviewFallbackText(page).catch(() => "")) ||
			turndown
				.turndown(await extractAiOverviewFallbackHtml(page).catch(() => ""))
				.replace(/\n{3,}/g, "\n\n")
				.trim();
		if (text.trim().length >= 50) {
			if (text === lastText) {
				stablePolls += 1;
			} else {
				lastText = text;
				stablePolls = 1;
			}

			if (stablePolls >= AI_OVERVIEW_STABLE_POLLS_REQUIRED) {
				return;
			}
		}

		await page.waitForTimeout(AI_OVERVIEW_SETTLE_POLL_MS);
	}

	// AI Overview is not a chat stream. If the block is present but still changing,
	// do not stall the job longer than the short settle window.
	await page.waitForTimeout(500);
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	label: "AI Overview",
	displayName: "AI Overview",
	skipInitialNavigation: true,
	responseScrollBehavior: "top",
	sanitizeSources: (sources) => {
		const blockedDomains = new Set([
			"accounts.google.com",
			"support.google.com",
			"policies.google.com",
		]);
		const blockedLabels = new Set(["sign in", "help", "privacy", "terms"]);
		return sources.filter((source) => {
			const domain = source.domain?.toLowerCase() ?? "";
			const title = source.title.trim().toLowerCase();
			const citedText = source.cited_text.trim().toLowerCase();
			if (blockedDomains.has(domain)) return false;
			if (blockedLabels.has(title) || blockedLabels.has(citedText)) return false;
			return true;
		});
	},
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
	waitForResponse: (page) => waitForAiOverviewReady(page),
	beforeResponseExtractionHook: (page) => prepareAiOverviewViewport(page),
	extractResponse: async (page) => {
		await prepareAiOverviewViewport(page);
		const fallbackText = await extractAiOverviewFallbackText(page);
		if (fallbackText) {
			return fallbackText;
		}

		const fallbackHtml = await extractAiOverviewFallbackHtml(page);
		if (fallbackHtml) {
			return turndown.turndown(fallbackHtml).replace(/\n{3,}/g, "\n\n").trim();
		}

		return "";
	},
	betweenPromptsHook: async (page) => {
		await page.waitForTimeout(8000 + Math.floor(Math.random() * 12000));
	},
};
