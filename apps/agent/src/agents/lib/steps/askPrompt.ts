import { Page } from "playwright";
import { waitForEditorReady } from "../../../lib/input/findActiveEditor.js";
import { findEnabledSendButton } from "../../../lib/input/findEnabledSendButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";

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

    logger.debug("  📤 Submitting...");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    const generationStarted = await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector(
            '[aria-label*="stop" i], [class*="loading"], [class*="typing"]'
          )
        ),
      { timeout: 5000 }
    ).then(() => true).catch(() => false);
  
    if (!generationStarted) {
      logger.warn("Enter did not start generation, using send button");
  
      const sendButton = await findEnabledSendButton(page);
      if (!sendButton) {
        throw new Error(`[${provider}] Send failed — no send button`);
      }
  
      await sendButton.click();
  
      const fallbackStarted = await page.waitForFunction(
        () =>
          Boolean(
            document.querySelector(
              '[aria-label*="stop" i], [class*="loading"], [class*="typing"]'
            )
          ),
        { timeout: 5000 }
      ).then(() => true).catch(() => false);
  
      if (!fallbackStarted) {
        throw new Error(`[${provider}] Send failed — no generation after click`);
      }
    }
}