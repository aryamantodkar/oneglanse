import { Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { waitForEditorReady } from "../../../lib/input/findActiveEditor.js";
import { findEnabledSendButton } from "../../../lib/input/findEnabledSendButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

async function captureSubmitScreenshot(
  page: Page,
  provider: Provider,
  stage: "after-enter" | "after-send-click-failed"
): Promise<void> {
  try {
    const dir = path.resolve(process.cwd(), "debug-screenshots");
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${provider}-${stage}-${Date.now()}.png`;
    const outputPath = path.join(dir, filename);
    await page.screenshot({ path: outputPath, fullPage: true });
    logger.debug(`📸 Submit screenshot saved: ${outputPath}`);
  } catch (error) {
    logger.warn(
      `Failed to capture ${stage} screenshot: ${(error as Error)?.message ?? "unknown error"}`
    );
  }
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

    await page.waitForTimeout(5000);

    logger.debug("  📤 Submitting...");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);
    await captureSubmitScreenshot(page, provider, "after-enter");

    // Wait for any navigation triggered by submit (e.g. Perplexity navigates to /search)
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});

    const generationStarted = await withTimeout(
      page.waitForFunction(
        () =>
          Boolean(
            document.querySelector(
              '[aria-label*="stop" i], [class*="loading"], [class*="typing"], button[aria-label="Stop generating response"]'
            )
          ),
        { timeout: 10000 }
      ).then(() => true).catch(() => false),
      15000,
      false
    );

    if (!generationStarted) {
      logger.warn("Enter did not start generation, using send button");

      const sendButton = await findEnabledSendButton(page);
      if (!sendButton) {
        throw new Error(`[${provider}] Send failed — no send button`);
      }

      await sendButton.click();

      const fallbackStarted = await withTimeout(
        page.waitForFunction(
          () =>
            Boolean(
              document.querySelector(
                '[aria-label*="stop" i], [class*="loading"], [class*="typing"]'
              )
            ),
          { timeout: 10000 }
        ).then(() => true).catch(() => false),
        15000,
        false
      );

      if (!fallbackStarted) {
        await captureSubmitScreenshot(page, provider, "after-send-click-failed");
        throw new Error(`[${provider}] Send failed — no generation after click`);
      }
    }
}
