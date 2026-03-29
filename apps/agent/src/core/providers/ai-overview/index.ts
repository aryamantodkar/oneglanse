import { ExternalServiceError } from "@oneglanse/errors";
import { PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { env } from "../../../env.js";
import { moveMouseToElement } from "../../../lib/browser/humanBehavior.js";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import {
	formatPromptInsertionStrategy,
	getPromptInsertionStrategy,
	insertPromptIntoEditor,
} from "../../../lib/input/editor/promptInput.js";
import { turndown } from "../../../lib/input/markdown/converter.js";
import type { ProviderConfig } from "../types.js";
import { extractAIOverviewResponse } from "./lib/extractResponse.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function normalizeSearchQuery(prompt: string): string {
	return prompt.replace(/\s+/g, " ").trim();
}

const GOOGLE_CONSENT_SELECTOR =
	"button#L2AGLb, button#W0wltc, form[action*='consent.google.com'] button";

const GOOGLE_HOME_URL = "https://www.google.com/";
const GOOGLE_RESULTS_ROOT_SELECTOR = "#search, #rso, main";
const GOOGLE_AIO_CONTAINER_SELECTOR =
	'[data-container-id="model-response-placeholder"], [data-container-id="main-col"]';
const SEARCH_RESULTS_WAIT_MS = 8_000;
const RESULTS_STABLE_WITHOUT_AIO_MS = 8_000;
const NO_AI_OVERVIEW_RETRY_LIMIT = 1;
const NO_AI_OVERVIEW_MARKER = "<!--ai-overview:none-->";

type AiOverviewState = {
	query: string;
	noAiRetryCount: number;
};

const aiOverviewState = new WeakMap<Page, AiOverviewState>();

async function findVisibleSearchInput(page: Page) {
	for (const selector of PROVIDER_EDITOR_SELECTORS["ai-overview"]) {
		const nodes = page.locator(selector);
		const count = await nodes.count().catch(() => 0);
		for (let i = 0; i < count; i++) {
			const candidate = nodes.nth(i);
			const visible = await candidate.isVisible().catch(() => false);
			if (visible) {
				logger.log(`[ai-overview] using search selector: ${selector}`);
				return candidate;
			}
		}
	}

	return null;
}

function isGoogleSearchResultsUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			url.hostname === "www.google.com" && url.pathname.startsWith("/search")
		);
	} catch {
		return false;
	}
}

function isGoogleHomepageUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			url.hostname === "www.google.com" &&
			(url.pathname === "/" || url.pathname === "")
		);
	} catch {
		return false;
	}
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
	if (url.includes("consent.google.com")) {
		throw new ExternalServiceError(
			"ai-overview",
			"Google consent page not dismissible — proxy IP requires Google consent",
			429,
		);
	}
}

async function dismissConsentDialog(page: Page): Promise<void> {
	const consentBtn = page.locator(GOOGLE_CONSENT_SELECTOR).first();
	const visible = await consentBtn
		.isVisible({ timeout: 2500 })
		.catch(() => false);
	if (!visible) return;
	await consentBtn.click({ timeout: 4000 });
}

async function hasVisibleMatch(page: Page, selector: string): Promise<boolean> {
	const nodes = page.locator(selector);
	const count = await nodes.count().catch(() => 0);
	for (let i = 0; i < count; i++) {
		if (
			await nodes
				.nth(i)
				.isVisible()
				.catch(() => false)
		) {
			return true;
		}
	}

	return false;
}

async function ensureHomepageSearchInput(page: Page) {
	if (!isGoogleHomepageUrl(page.url())) {
		logger.log(
			"[ai-overview] search box not found, returning to google.com homepage",
		);
		await navigateWithRetry(page, GOOGLE_HOME_URL, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
	}
	assertNotBlockedPage(page);
	await dismissConsentDialog(page);

	let input = await findVisibleSearchInput(page);
	if (input) return input;

	await page.waitForTimeout(400);
	input = await findVisibleSearchInput(page);
	if (input) return input;

	throw new ExternalServiceError(
		"ai-overview",
		"Search box not found on Google homepage",
	);
}

async function waitForSearchResults(page: Page): Promise<void> {
	const deadline = Date.now() + SEARCH_RESULTS_WAIT_MS;
	while (Date.now() < deadline) {
		const url = await page.getUrl().catch(() => page.url());
		if (isGoogleSearchResultsUrl(url)) return;
		assertNotBlockedPage(page);
		await page.waitForTimeout(150);
	}

	throw new ExternalServiceError(
		"ai-overview",
		`Not on search results page after submission (url: ${page.url()})`,
	);
}

async function waitForAiOverviewPageState(page: Page): Promise<void> {
	const deadline = Date.now() + env.AI_OVERVIEW_WAIT_TIMEOUT_MS;
	let resultsVisibleSince: number | null = null;

	while (Date.now() < deadline) {
		assertNotBlockedPage(page);

		if (await hasVisibleMatch(page, GOOGLE_AIO_CONTAINER_SELECTOR)) {
			return;
		}

		if (
			isGoogleSearchResultsUrl(page.url()) &&
			(await hasVisibleMatch(page, GOOGLE_RESULTS_ROOT_SELECTOR))
		) {
			if (resultsVisibleSince === null) {
				resultsVisibleSince = Date.now();
			}
			if (Date.now() - resultsVisibleSince >= RESULTS_STABLE_WITHOUT_AIO_MS) {
				return;
			}
		}

		await page.waitForTimeout(250);
	}
}

async function inspectAiOverviewState(
	page: Page,
): Promise<"present" | "no_ai_overview" | "unknown"> {
	assertNotBlockedPage(page);

	if (await hasVisibleMatch(page, GOOGLE_AIO_CONTAINER_SELECTOR)) {
		return "present";
	}

	if (
		isGoogleSearchResultsUrl(page.url()) &&
		(await hasVisibleMatch(page, GOOGLE_RESULTS_ROOT_SELECTOR))
	) {
		return "no_ai_overview";
	}

	return "unknown";
}

function buildNoAiOverviewResponse(query: string): string {
	return `${NO_AI_OVERVIEW_MARKER}

Google Search completed successfully for "${query}", but this results page did not render an AI Overview. Treat this as a no-overview outcome rather than a selector or submission failure for this prompt.`;
}

async function runAiOverviewSearch(
	page: Page,
	prompt: string,
	options?: { preserveRetryCount?: boolean },
): Promise<void> {
	const query = normalizeSearchQuery(prompt);
	const previousState = aiOverviewState.get(page);
	aiOverviewState.set(page, {
		query,
		noAiRetryCount: options?.preserveRetryCount
			? (previousState?.noAiRetryCount ?? 0)
			: 0,
	});

	const searchInput = await ensureHomepageSearchInput(page);

	if (!env.CAMOUFOX_HUMANIZE) {
		await moveMouseToElement(page, searchInput);
	}

	const predictedStrategy = getPromptInsertionStrategy(query);
	logger.debug(
		`[ai-overview] ${formatPromptInsertionStrategy(predictedStrategy)} ${query.length} chars…`,
	);
	const { strategy } = await insertPromptIntoEditor(
		page,
		searchInput,
		query,
		"ai-overview",
	);
	logger.debug(
		`[ai-overview] ${formatPromptInsertionStrategy(strategy)} ${query.length} chars complete`,
	);
	await page.waitForTimeout(randomBetween(400, 900));
	logger.debug("[ai-overview] attempting submission…");
	await searchInput.press("Enter").catch(() => null);
	await page.waitForLoadState("domcontentloaded").catch(() => {});
	await waitForSearchResults(page);

	assertNotBlockedPage(page);
	await dismissConsentDialog(page);
	logger.log(`[ai-overview] search ready: ${page.url()}`);
}

async function extractAiOverviewMarkdown(page: Page): Promise<string> {
	const extraction = await extractAIOverviewResponse(page);
	const state = await inspectAiOverviewState(page);
	const session = aiOverviewState.get(page);

	if (extraction.kind === "response") {
		return turndown.turndown(extraction.html);
	}

	if (
		extraction.kind === "no_ai_overview" ||
		(extraction.kind === "selector_error" && state === "no_ai_overview")
	) {
		if (session && session.noAiRetryCount < NO_AI_OVERVIEW_RETRY_LIMIT) {
			session.noAiRetryCount += 1;
			logger.warn(
				"[ai-overview] no AI Overview rendered — retrying once from the Google homepage on the same session",
			);
			await runAiOverviewSearch(page, session.query, {
				preserveRetryCount: true,
			});
			await waitForAiOverviewPageState(page);
			return extractAiOverviewMarkdown(page);
		}

		logger.warn("[ai-overview] no AI Overview rendered after local retry");
		return buildNoAiOverviewResponse(session?.query ?? "this query");
	}

	throw new ExternalServiceError("ai-overview", extraction.reason);
}

export const aiOverviewConfig: ProviderConfig = {
	url: "https://www.google.com/",
	label: "AI Overview",
	displayName: "AI Overview",
	navigateToPrompt: (page, prompt) => runAiOverviewSearch(page, prompt),
	waitForResponse: async (page) => {
		await waitForAiOverviewPageState(page);
	},
	extractResponse: (page) => extractAiOverviewMarkdown(page),
	extractSources: (page) => extractAIOverviewSources(page),
};
