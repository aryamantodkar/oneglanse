import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { getText } from "../../../lib/input/response/getText.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { exponentialBackoff } from "@onescope/utils";
import { NoAIOverviewError } from "../errors.js";

const MAX_EXTRACTION_RETRIES = Number(process.env.MAX_EXTRACTION_RETRIES ?? 2);
const INITIAL_EXTRACTION_RETRY_DELAY = Number(
	process.env.EXTRACTION_RETRY_DELAY_MS ?? 2000,
);
const MAX_EXTRACTION_RETRY_DELAY = Number(
	process.env.MAX_EXTRACTION_RETRY_DELAY_MS ?? 5000,
);


export async function fetchPromptResponses(
	page: Page,
	provider: Provider,
): Promise<string> {
	// Google AI Overview doesn't have a "generating" phase - results appear immediately
	if (provider === "google-ai-overview") {
		logger.log("⏳ Waiting for search results to load...");
		// Wait for page to be stable
		await page
			.waitForLoadState("networkidle", { timeout: 10000 })
			.catch(() => {});
		await page.waitForTimeout(2000); // Give AI Overview time to render

		// Bail early if Google hit us with a CAPTCHA page
		const currentUrl = page.url();
		if (currentUrl.includes("/sorry/")) {
			throw new Error(
				`[${provider}] Google CAPTCHA detected — proxy IP is flagged`,
			);
		}

		// Check whether Google is actually showing an AI Overview for this query.
		// If main-col has no text, Google served a different layout (Videos, News, etc.)
		// — no proxy rotation needed, this is a query-level signal.
		const hasAIOverview = await page.evaluate(() => {
			const mainCol = document.querySelector(
				'[data-container-id="main-col"]',
			);
			return mainCol !== null && (mainCol.textContent?.trim().length ?? 0) > 50;
		});

		if (!hasAIOverview) {
			throw new NoAIOverviewError(
				`[${provider}] No AI Overview for this query — Google showed a different result layout`,
			);
		}
	} else {
		logger.log("⏳ Waiting for response to complete...");
		// 1️⃣ Wait until model finishes generating
		await waitForAssistantToFinish(page, provider);

		await page.waitForTimeout(1500);
	}

	logger.log("📄 Extracting response...");

	// 2️⃣ Extract markdown-only response with retries (no plain-text fallback)
	for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
		// Keep this short so we can rotate IPs faster if extraction keeps failing.
		await page.waitForTimeout(500);

		const response = await extractAssistantMarkdown(page, provider);

		if (response && response.length > 0) {
			logger.success(`Got response (${response.length} chars)`);
			return response;
		}

		if (attempt < MAX_EXTRACTION_RETRIES) {
			const retryDelay =
				attempt <= 1
					? INITIAL_EXTRACTION_RETRY_DELAY
					: exponentialBackoff(attempt - 1, INITIAL_EXTRACTION_RETRY_DELAY, MAX_EXTRACTION_RETRY_DELAY);
			logger.warn(
				`Extraction empty, retrying in ${retryDelay / 1000}s (attempt ${attempt}/${MAX_EXTRACTION_RETRIES})...`,
			);
			await page.waitForTimeout(retryDelay);
		}
	}

	// Diagnostic only. We do not return plain text to avoid UI inconsistency.
	const visibleText = await getText(page, provider, true).catch(
		() => "",
	);
	const visibleTextChars = visibleText?.trim().length ?? 0;
	throw new Error(
		`[${provider}] Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries (visibleTextChars=${visibleTextChars})`,
	);
}
