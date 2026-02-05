import { Page } from "playwright";
import { extractAssistantMarkdown } from "../../../lib/input/extractAssistantMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";

export async function fetchPromptResponses(
    page: Page,
    provider: Provider
  ): Promise<string> {
    logger.log("⏳ Waiting for response to complete...");

    // 1️⃣ Wait until model finishes generating
    await waitForAssistantToFinish(page, provider);

    logger.log("📄 Extracting response...");

    // 2️⃣ Extract response as markdown (innerHTML → turndown)
    const response = await extractAssistantMarkdown(page, provider);

    if (!response) {
      logger.warn("No assistant response found");
      return "";
    }

    logger.success(`Got response (${response.length} chars)`);
    return response;
  }