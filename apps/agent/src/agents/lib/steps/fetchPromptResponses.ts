import { Page } from "playwright";
import { extractAssistantMarkdown } from "../../../lib/input/extractAssistantMarkdown.js";
import { getLastAssistantText } from "../../../lib/input/getLastAssistantText.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";

const MAX_EXTRACTION_RETRIES = 3;
const EXTRACTION_RETRY_DELAY = 10000;

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
      // Some providers mark "done" before markdown blocks are fully mounted.
      // Re-check stabilization each retry to reduce timing race conditions.
      await waitForAssistantToFinish(page, provider).catch(() => {});

      const response = await extractAssistantMarkdown(page, provider);

      if (response && response.length > 0) {
        logger.success(`Got response (${response.length} chars)`);
        return response;
      }

      if (attempt < MAX_EXTRACTION_RETRIES) {
        logger.warn(`Extraction empty, retrying in ${EXTRACTION_RETRY_DELAY / 1000}s (attempt ${attempt}/${MAX_EXTRACTION_RETRIES})...`);
        await page.waitForTimeout(EXTRACTION_RETRY_DELAY);
      }
    }

    // Diagnostic only. We do not return plain text to avoid UI inconsistency.
    const visibleText = await getLastAssistantText(page, provider, true).catch(() => "");
    const visibleTextChars = visibleText?.trim().length ?? 0;
    throw new Error(
      `[${provider}] Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries (visibleTextChars=${visibleTextChars})`
    );
  }
