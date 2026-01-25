import { Page } from "playwright";
import { getLastAssistantText } from "../../../lib/input/getLastAssistantText.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { Provider } from "../../../types/types.js";
import { logger } from "../../../lib/utils/logger.js";

export async function fetchPromptResponses(
    page: Page,
    provider: Provider
  ): Promise<string> {
    logger.log("⏳ Waiting for response to complete...");
  
    // 1️⃣ Wait until model finishes generating
    await waitForAssistantToFinish(page, provider);
  
    logger.log("📄 Extracting response...");
  
    // 2️⃣ Single source of truth for extraction
    const response = await getLastAssistantText(page, provider, true);
  
    if (!response) {
      logger.warn("No assistant response found");
      return "";
    }
  
    logger.success(`Got response (${response.length} chars)`);
    return response;
  }