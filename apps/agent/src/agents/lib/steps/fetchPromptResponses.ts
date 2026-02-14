import { Page } from "playwright";
import { extractAssistantMarkdown } from "../../../lib/input/extractAssistantMarkdown.js";
import { getLastAssistantText } from "../../../lib/input/getLastAssistantText.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";

const MAX_EXTRACTION_RETRIES = Number(process.env.MAX_EXTRACTION_RETRIES ?? 1);
const INITIAL_EXTRACTION_RETRY_DELAY = Number(process.env.EXTRACTION_RETRY_DELAY_MS ?? 2000);
const MAX_EXTRACTION_RETRY_DELAY = Number(process.env.MAX_EXTRACTION_RETRY_DELAY_MS ?? 5000);

function getExtractionRetryDelay(attempt: number): number {
  if (attempt <= 1) return INITIAL_EXTRACTION_RETRY_DELAY;
  return Math.min(INITIAL_EXTRACTION_RETRY_DELAY * Math.pow(2, attempt - 1), MAX_EXTRACTION_RETRY_DELAY);
}

export async function fetchPromptResponses(
    page: Page,
    provider: Provider
  ): Promise<string> {
    logger.log("⏳ Waiting for response to complete...");

    // 1️⃣ Wait until model finishes generating
    await waitForAssistantToFinish(page, provider);

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
        const retryDelay = getExtractionRetryDelay(attempt);
        logger.warn(`Extraction empty, retrying in ${retryDelay / 1000}s (attempt ${attempt}/${MAX_EXTRACTION_RETRIES})...`);
        await page.waitForTimeout(retryDelay);
      }
    }

    // Diagnostic only. We do not return plain text to avoid UI inconsistency.
    const visibleText = await getLastAssistantText(page, provider, true).catch(() => "");
    const visibleTextChars = visibleText?.trim().length ?? 0;
    throw new Error(
      `[${provider}] Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries (visibleTextChars=${visibleTextChars})`
    );
  }
