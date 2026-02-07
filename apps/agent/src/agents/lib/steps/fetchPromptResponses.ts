import { Page } from "playwright";
import { extractAssistantMarkdown } from "../../../lib/input/extractAssistantMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";

const MAX_EXTRACTION_RETRIES = 5;
const EXTRACTION_RETRY_DELAY = 2000;

export async function fetchPromptResponses(
    page: Page,
    provider: Provider
  ): Promise<string> {
    logger.log("⏳ Waiting for response to complete...");

    // 1️⃣ Wait until model finishes generating
    await waitForAssistantToFinish(page, provider);

    logger.log("📄 Extracting response...");

    // 2️⃣ Extract response with retries (handles timing issues)
    for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
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

    logger.warn("No assistant response found after retries");
    return "";
  }