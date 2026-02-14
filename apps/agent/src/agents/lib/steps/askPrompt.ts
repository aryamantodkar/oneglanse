import { Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { waitForEditorReady } from "../../../lib/input/findActiveEditor.js";
import { findEnabledSendButton } from "../../../lib/input/findEnabledSendButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";
import { RESPONSE_GENERATION_SELECTORS } from "@onescope/utils";

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

export async function askPrompt(page: Page, prompt: string, provider: Provider): Promise<void> {
    logger.debug(`\n💬 Asking: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`);

    await waitForAssistantToFinish(page, provider);

    const input = await waitForEditorReady(page, provider);

    logger.debug("Typing Prompt");

    await input.click({ force: true });
    await page.waitForTimeout(100);

    await input.evaluate(el => {
      if (el instanceof HTMLElement) el.innerText = "";
    });

    const isMac = process.platform === "darwin";
    await page.keyboard.down(isMac ? "Meta" : "Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up(isMac ? "Meta" : "Control");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);

    for (const char of prompt) {
      if (char === "\n") {
        await page.keyboard.down("Shift");
        await page.keyboard.press("Enter");
        await page.keyboard.up("Shift");
      } else {
        await page.keyboard.type(char);
      }
      await page.waitForTimeout(10);
    }

    await page.waitForTimeout(500);

    const typed = await input.evaluate(el =>
      (el.textContent || "").trim()
    );

    if (!typed || typed.length < Math.min(10, prompt.length / 3)) {
      throw new Error("Typing failed: editor did not receive prompt");
    }

    // Wait for send button to appear after typing (dynamic UI)
    await page.waitForTimeout(500);

    logger.debug("  📤 Submitting...");

    // Check if editor still has content before submitting
    const preSubmitContent = await input.evaluate(el => (el.textContent || "").trim());
    logger.debug(`  Editor content before submit (${preSubmitContent.length} chars): ${preSubmitContent.slice(0, 50)}...`);

    // Find the send button AFTER typing (it appears dynamically)
    const sendButton = await findEnabledSendButton(page);

    // Use comprehensive generation detection (filter out pseudo-selectors for waitForSelector)
    const cssSelectors = RESPONSE_GENERATION_SELECTORS.filter(s => !s.includes(':has-text('));
    const generationSelector = cssSelectors.join(', ');

    if (!sendButton) {
      logger.warn("Send button not found after typing, trying Enter key");

      // Ensure focus is on the input before pressing Enter
      await input.focus();
      await page.waitForTimeout(300);

      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);

      // Wait for any navigation triggered by submit (e.g. Perplexity navigates to /search)
      await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});

      const generationStarted = await withTimeout(
        page.waitForSelector(generationSelector, { state: "visible", timeout: 10000 })
          .then(() => {
            logger.debug(`  ✓ Generation started`);
            return true;
          })
          .catch(() => {
            logger.debug(`  No generation indicators found. Checked: ${cssSelectors.slice(0, 3).join(', ')}`);
            return false;
          }),
        15000,
        false
      );

      if (!generationStarted) {
        throw new Error(`[${provider}] Submit failed — Enter key didn't work and no send button found`);
      }
    } else {
      // Send button found - click it directly
      logger.debug(`  Clicking send button...`);
      await sendButton.click();
      await page.waitForTimeout(1000);

      // Wait for any navigation triggered by submit
      await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});

      const generationStarted = await withTimeout(
        page.waitForSelector(generationSelector, { state: "visible", timeout: 10000 })
          .then(() => {
            logger.debug(`  ✓ Generation started after button click`);
            return true;
          })
          .catch(() => {
            logger.debug(`  No generation indicators found after button click`);
            return false;
          }),
        15000,
        false
      );

      if (!generationStarted) {
        throw new Error(`[${provider}] Send failed — no generation after button click`);
      }
    }
}
