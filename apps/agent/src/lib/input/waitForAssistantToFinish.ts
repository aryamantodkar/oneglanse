import { Page } from "playwright";
import { getLastAssistantText, isGenerating } from "./getLastAssistantText.js";
import { Provider } from "@onescope/types";
import { logger } from "../utils/logger.js";

export async function waitForAssistantToFinish(page: Page, provider: Provider): Promise<void> {
  logger.debug("⏳ Waiting for assistant to finish…");

  const MAX_WAIT = 20 * 60 * 1000;
  const STABLE_WINDOW = 1500;
  const POLL = 300;

  const start = Date.now();

  let lastText = "";
  let lastChange = Date.now();
  let seenOutput = false;

  while (Date.now() - start < MAX_WAIT) {
    const generating = await isGenerating(page);
    const text = await getLastAssistantText(page, provider);

    if (text.length > 0) {
      seenOutput = true;
    }

    if (text !== lastText) {
      lastText = text;
      lastChange = Date.now();
    }

    if (generating && !seenOutput) {
      await page.waitForTimeout(POLL);
      continue;
    }

    // ✅ Exit condition (THIS is the important part)
    if (
      seenOutput &&
      !generating &&
      Date.now() - lastChange >= STABLE_WINDOW
    ) {
      logger.debug("✅ Assistant finished");
      return;
    }

    await page.waitForTimeout(POLL);
  }

  logger.warn("Assistant finish wait timed out.");
}