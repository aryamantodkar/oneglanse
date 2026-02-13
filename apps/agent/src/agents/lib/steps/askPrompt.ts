import { Page } from "playwright";
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

export async function askPrompt(page: Page, prompt: string, provider: Provider): Promise<void> {
  logger.debug(`💬 Asking: "${prompt.slice(0, 60)}${prompt.length > 60 ? '...' : ''}"`);

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
    if (char === "\\n") {
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

  const isPerplexity = provider.toLowerCase() === 'perplexity';
  const urlBefore = page.url();

  // Press Enter
  await page.keyboard.press("Enter");

  // **CRITICAL FIX: Wait for navigation and page load**
  if (isPerplexity) {
    try {
      logger.debug("  🔄 Waiting for Perplexity navigation...");
      
      // Wait for URL to change to /search/ pattern (max 10s)
      await page.waitForFunction(
        (oldUrl) => {
          const newUrl = window.location.href;
          return newUrl !== oldUrl && newUrl.includes('/search/');
        },
        urlBefore,
        { timeout: 10000 }
      );
      
      logger.debug("  ✓ URL changed");
      
      // Wait for network to be mostly idle (critical for Perplexity)
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
        logger.debug("  ⚠️ Network not idle, continuing");
      });
      
      // Wait for DOM to be ready
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
      
      // **CRITICAL: Extra wait for React hydration**
      // Perplexity uses React which needs time to mount
      await page.waitForTimeout(2000);
      
      logger.debug("  ✓ Page loaded and hydrated");
    } catch (navError) {
      let msg: string;
      if (navError instanceof Error) {
        msg = navError.message;
      } else if (typeof navError === "object" && navError !== null && "message" in navError) {
        // @ts-ignore
        msg = (navError as any).message;
      } else {
        msg = String(navError);
      }
      logger.warn(`  ⚠️ Navigation wait failed: ${msg}`);
      // Don't throw - try to continue anyway
    }
  } else {
    // Other providers - original logic
    await page.waitForTimeout(2000);
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  }

  // Now check for generation start with proper selectors
  const generationStarted = await withTimeout(
    page.waitForFunction(
      (providerName) => {
        if (providerName === 'perplexity') {
          // Perplexity-specific: Check multiple indicators
          const stopBtn = document.querySelector('button[aria-label="Stop generating response"]');
          if (stopBtn) return true;

          const thinking = Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent?.trim() === 'Thinking'
          );
          if (thinking) return true;

          const searching = Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent?.includes('Searching')
          );
          if (searching) return true;

          const stepsCompleted = Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent?.includes('steps completed')
          );
          if (stepsCompleted) return true;

          return false;
        } else {
          // Other providers - original logic
          return Boolean(
            document.querySelector(
              '[aria-label*="stop" i], [class*="loading"], [class*="typing"]'
            )
          );
        }
      },
      provider,
      { timeout: 15000 }
    ).then(() => true).catch(() => false),
    20000, // Longer timeout for Perplexity
    false
  );

  if (!generationStarted) {
    logger.warn("Enter did not start generation, using send button");

    const sendButton = await findEnabledSendButton(page);
    if (!sendButton) {
      throw new Error(`[${provider}] Send failed — no send button`);
    }

    await sendButton.click();

    // Same navigation wait for button click
    if (isPerplexity) {
      try {
        await page.waitForFunction(
          (oldUrl) => {
            const newUrl = window.location.href;
            return newUrl !== oldUrl && newUrl.includes('/search/');
          },
          page.url(),
          { timeout: 10000 }
        );
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await page.waitForTimeout(2000);
      } catch {}
    }

    const fallbackStarted = await withTimeout(
      page.waitForFunction(
        (providerName) => {
          if (providerName === 'perplexity') {
            return Boolean(
              document.querySelector('button[aria-label="Stop generating response"]') ||
              Array.from(document.querySelectorAll('*')).some(el => 
                el.textContent?.trim() === 'Thinking' || 
                el.textContent?.includes('Searching') ||
                el.textContent?.includes('steps completed')
              )
            );
          } else {
            return Boolean(
              document.querySelector(
                '[aria-label*="stop" i], [class*="loading"], [class*="typing"]'
              )
            );
          }
        },
        provider,
        { timeout: 15000 }
      ).then(() => true).catch(() => false),
      20000,
      false
    );

    if (!fallbackStarted) {
      throw new Error(`[${provider}] Send failed — no generation after click`);
    }
  }
  
  logger.debug("  ✓ Generation started successfully");
}