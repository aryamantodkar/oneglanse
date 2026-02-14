import { Page } from "playwright";
import { getLastAssistantText, isGenerating } from "./getLastAssistantText.js";
import { Provider } from "@onescope/types";
import { logger } from "../utils/logger.js";

export async function waitForAssistantToFinish(page: Page, provider: Provider): Promise<void> {
  logger.debug("⏳ Waiting for assistant to finish…");

  const MAX_WAIT = 20 * 60 * 1000; // 20 minutes
  const STABLE_WINDOW = 1500; // 1.5s — normal exit when generation indicators are gone
  const FORCE_STABLE_WINDOW = 15_000; // 15s — force exit even if isGenerating() is still true
  const NO_OUTPUT_TIMEOUT = 45_000; // 45s — timeout if no output detected at all
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

    const stableFor = Date.now() - lastChange;
    const elapsedTime = Date.now() - start;

    // Timeout if no output seen within 60 seconds
    if (!seenOutput && elapsedTime >= NO_OUTPUT_TIMEOUT) {
      logger.error(`No output detected after ${NO_OUTPUT_TIMEOUT / 1000}s — generation may have failed`);
      throw new Error(`[${provider}] No response detected after ${NO_OUTPUT_TIMEOUT / 1000}s`);
    }

    // Normal exit: generation done + text stable for 1.5s
    if (seenOutput && !generating && stableFor >= STABLE_WINDOW) {
      logger.debug("✅ Assistant finished");
      return;
    }

    // Force exit: text has been stable for 15s even though isGenerating() is still true
    // This handles false-positive generation detection (e.g. a persistent loading class)
    if (seenOutput && stableFor >= FORCE_STABLE_WINDOW) {
      logger.warn("Assistant text stable for 15s but generation indicator still present — forcing exit");
      return;
    }

    await page.waitForTimeout(POLL);
  }

  logger.warn("Assistant finish wait timed out.");
}
