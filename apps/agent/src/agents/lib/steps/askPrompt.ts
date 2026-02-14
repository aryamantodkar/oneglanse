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

    await page.waitForTimeout(2000);

    logger.debug("  📤 Submitting...");

    // Check if editor still has content before submitting
    const preSubmitContent = await input.evaluate(el => (el.textContent || "").trim());
    logger.debug(`  Editor content before submit (${preSubmitContent.length} chars): ${preSubmitContent.slice(0, 50)}...`);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // Wait for any navigation triggered by submit (e.g. Perplexity navigates to /search)
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});

    // Use comprehensive generation detection selectors
    const generationSelector = RESPONSE_GENERATION_SELECTORS.join(', ');

    const generationStarted = await withTimeout(
      page.waitForSelector(generationSelector, { state: "visible", timeout: 10000 })
        .then(() => true)
        .catch(() => {
          logger.debug(`  No generation indicators found. Checked: ${RESPONSE_GENERATION_SELECTORS.slice(0, 3).join(', ')}`);
          return false;
        }),
      15000,
      false
    );

    if (!generationStarted) {
      logger.warn("Enter did not start generation, using send button");

      const sendButton = await findEnabledSendButton(page);
      if (!sendButton) {
        // Debug: check what's on the page
        const pageInfo = await page.evaluate(() => ({
          url: window.location.href,
          editorExists: !!document.querySelector('#ask-input'),
          editorContent: document.querySelector('#ask-input')?.textContent?.slice(0, 50),
          editorEditable: document.querySelector('#ask-input')?.getAttribute('contenteditable'),
          sendButtonsFound: Array.from(document.querySelectorAll('button')).slice(0, 5).map(b => ({
            text: b.textContent?.trim(),
            ariaLabel: b.getAttribute('aria-label'),
            disabled: (b as HTMLButtonElement).disabled,
          })),
        })).catch(() => null);

        logger.warn(`[${provider}] Page state: ${JSON.stringify(pageInfo, null, 2)}`);
        throw new Error(`[${provider}] Send failed — no send button`);
      }

      await sendButton.click();
      await page.waitForTimeout(1000);

      const fallbackStarted = await withTimeout(
        page.waitForSelector(generationSelector, { state: "visible", timeout: 10000 })
          .then(() => true)
          .catch(() => false),
        15000,
        false
      );

      if (!fallbackStarted) {
        throw new Error(`[${provider}] Send failed — no generation after click`);
      }
    }
}
