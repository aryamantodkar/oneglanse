import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { getText } from "../../../lib/input/response/getText.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { exponentialBackoff } from "@onescope/utils";
import { extractAIOverviewResponse } from "../../google/ai-overview/lib/extractResponse.js";
import { turndown } from "../../../lib/input/markdown/converter.js";

const MAX_EXTRACTION_RETRIES = Number(process.env.MAX_EXTRACTION_RETRIES ?? 2);
const INITIAL_EXTRACTION_RETRY_DELAY = Number(
	process.env.EXTRACTION_RETRY_DELAY_MS ?? 2000,
);
const MAX_EXTRACTION_RETRY_DELAY = Number(
	process.env.MAX_EXTRACTION_RETRY_DELAY_MS ?? 5000,
);
const AI_OVERVIEW_WAIT_TIMEOUT_MS = Number(
	process.env.AI_OVERVIEW_WAIT_TIMEOUT_MS ?? 15000,
);

async function waitForAIOverviewContainer(page: Page): Promise<void> {
	const selectors = [
		'[data-container-id="model-response-placeholder"]',
		'[data-container-id="main-col"]',
		'div:has(> [data-container-id="main-col"])',
	];

	const start = Date.now();
	while (Date.now() - start < AI_OVERVIEW_WAIT_TIMEOUT_MS) {
		for (const selector of selectors) {
			const visible = await page
				.locator(selector)
				.first()
				.isVisible()
				.catch(() => false);
			if (visible) return;
		}
		await page.waitForTimeout(300);
	}

	throw new Error(
		`[google-ai-overview] AI Overview container not found within ${AI_OVERVIEW_WAIT_TIMEOUT_MS}ms`,
	);
}

export async function fetchPromptResponses(
	page: Page,
	provider: Provider,
): Promise<string> {
	if (provider !== "google-ai-overview") {
		logger.log("⏳ Waiting for response to complete...");
		// LLM chat providers stream/generate responses, so wait for completion.
		await waitForAssistantToFinish(page, provider);
	} else {
		logger.debug("Skipping assistant-finish wait for google-ai-overview");
		await waitForAIOverviewContainer(page);
	}

	await page.waitForTimeout(1500);

	logger.log("📄 Extracting response...");

	// 2️⃣ Extract markdown-only response with retries (no plain-text fallback)
	for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
		// Keep this short so we can rotate IPs faster if extraction keeps failing.
		await page.waitForTimeout(500);

		const response =
			provider === "google-ai-overview"
				? turndown.turndown(await extractAIOverviewResponse(page))
				: await extractAssistantMarkdown(page, provider);

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
