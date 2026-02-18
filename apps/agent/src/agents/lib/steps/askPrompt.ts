import { Page } from "playwright";
import { waitForEditorReady } from "../../../lib/input/findActiveEditor.js";
import { findEnabledSendButton } from "../../../lib/input/findEnabledSendButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/waitForAssistantToFinish.js";
import { logger } from "../../../lib/utils/logger.js";
import { Provider } from "@onescope/types";
import { RESPONSE_GENERATION_SELECTORS } from "@onescope/utils";

export async function askPrompt(page: Page, prompt: string, provider: Provider): Promise<void> {
    logger.debug(`\n💬 Asking: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`);

    if (provider !== "google-ai-overview") {
      await waitForAssistantToFinish(page, provider);
    }
    const input = await waitForEditorReady(page, provider);

    logger.debug("Typing Prompt");

    await input.click({ force: true });
    await page.waitForTimeout(100);

    await input.evaluate(el => {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        el.value = "";
      } else if (el instanceof HTMLElement) {
        el.innerText = "";
      }
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
      // Random delay between keystrokes (10-30ms) to appear more human
      const typingDelay = 10 + Math.floor(Math.random() * 20);
      await page.waitForTimeout(typingDelay);
    }

    await page.waitForTimeout(500);

    logger.debug("  📤 Submitting...");

    // Store pre-submit state for success detection
    const preSubmitContent = await input.evaluate(el => {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value.trim();
      return (el.textContent || "").trim();
    });
    const preSubmitUrl = page.url();

    // Verify we have content before attempting submission
    if (!preSubmitContent || preSubmitContent.length === 0) {
      throw new Error(`[${provider}] Typing failed: editor did not receive prompt`);
    }

    // Find send button AFTER typing (appears dynamically)
    // Wait a bit longer if needed for button to appear
    let sendButton = await findEnabledSendButton(page);
    if (!sendButton) {
      await page.waitForTimeout(500);
      sendButton = await findEnabledSendButton(page);
    }

    // Helper: Check if submission succeeded
    const checkSubmissionSuccess = async (): Promise<boolean> => {
      // Signal 1: URL change (Perplexity / Google Search)
      if (provider === "perplexity" || provider === "google-ai-overview") {
        const urlAfter = page.url();
        if (provider === "google-ai-overview" && urlAfter.includes("/sorry/")) {
          throw new Error(`[${provider}] Google CAPTCHA detected — proxy IP is flagged`);
        }
        if (urlAfter !== preSubmitUrl && (provider !== "google-ai-overview" || urlAfter.includes("/search"))) {
          logger.debug(`  ✓ Submission detected via URL: ${urlAfter}`);
          return true;
        }
      }

      // Signal 2: Editor cleared
      const editorContent = await input.evaluate(el => {
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value.trim();
        return (el.textContent || "").trim();
      }).catch(() => "");
      if (preSubmitContent.length > 0 && editorContent.length === 0) {
        logger.debug(`  ✓ Submission detected via editor clear: ${preSubmitContent.length} → 0 chars`);
        return true;
      }

      // Signal 3: Generation indicators
      const cssSelectors = RESPONSE_GENERATION_SELECTORS;
      const generationSelector = cssSelectors.join(', ');
      const hasIndicators = await page.locator(generationSelector).first().isVisible().catch(() => false);
      if (hasIndicators) {
        logger.debug(`  ✓ Submission detected via generation indicators`);
        return true;
      }

      // Signal 4: Stop button
      const hasStopButton = await page.locator('button[aria-label*="stop" i]').isVisible().catch(() => false);
      if (hasStopButton) {
        logger.debug(`  ✓ Submission detected via stop button`);
        return true;
      }

      // Signal 5: Send button disappeared
      if (sendButton) {
        const stillVisible = await sendButton.isVisible().catch(() => false);
        if (!stillVisible) {
          logger.debug(`  ✓ Submission detected via send button disappearing`);
          return true;
        }
      }

      return false;
    };

    // Method 1: Try Enter key FIRST
    const tryEnterSubmit = async (): Promise<boolean> => {
      logger.debug("  Method 1: Trying Enter key...");
      await input.focus();
      await page.waitForTimeout(300);
      await page.keyboard.press("Enter");
      // Longer wait for slower proxies (2-3 seconds)
      await page.waitForTimeout(2000 + Math.floor(Math.random() * 1000));
      return await checkSubmissionSuccess();
    };

    // Method 2: Force click
    const tryForceClick = async (button: any): Promise<boolean> => {
      logger.debug("  Method 2: Trying force click...");

      // Verify button is still visible
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) {
        logger.debug("  Button not visible, skipping force click");
        return false;
      }

      await button.scrollIntoViewIfNeeded().catch(() => {});
      await button.hover().catch(() => {});
      await page.waitForTimeout(200 + Math.floor(Math.random() * 200));
      await button.click({ force: true, timeout: 3000 });
      // Longer wait for slower proxies
      await page.waitForTimeout(2000 + Math.floor(Math.random() * 1000));
      return await checkSubmissionSuccess();
    };

    // Method 3: Synthetic MouseEvent dispatch
    const tryDispatchClick = async (button: any): Promise<boolean> => {
      logger.debug("  Method 3: Trying dispatch event...");

      // Verify button is still visible
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) {
        logger.debug("  Button not visible, skipping dispatch click");
        return false;
      }

      const handle = await button.elementHandle();
      if (!handle) {
        logger.debug("  Could not get button handle");
        return false;
      }

      await page.evaluate((el) => {
        if (el instanceof HTMLElement) {
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window,
            })
          );
        }
      }, handle);

      // Longer wait for slower proxies
      await page.waitForTimeout(2000 + Math.floor(Math.random() * 1000));
      return await checkSubmissionSuccess();
    };

    // Try methods in order
    let success = await tryEnterSubmit();
    if (!success && sendButton) success = await tryForceClick(sendButton);
    if (!success && sendButton) success = await tryDispatchClick(sendButton);

    if (!success) {
      throw new Error(`[${provider}] All submission methods failed`);
    }

    // Wait for page stabilization
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}
