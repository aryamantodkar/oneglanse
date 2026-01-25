import { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";


export async function ensureNewChat(page: Page): Promise<void> {
  logger.debug("\n🔄 Creating new chat...");

  // Method 1: Try keyboard shortcut first
  logger.debug("\n⌨️  Method 1: Keyboard Shortcut (Cmd/Ctrl+Shift+O)");
  if (await tryKeyboardShortcut(page)) {
    logger.debug("✅ SUCCESS: Keyboard shortcut worked!\n");
    return;
  }

  // Method 2: Try clicking buttons
  logger.debug("\n🖱️  Method 2: Clicking New Chat Button");
  if (await tryClickButtons(page)) {
    logger.debug("✅ SUCCESS: Button click worked!\n");
    return;
  }

  // If all methods failed, throw error
  logger.error("\nFAILED: All methods failed to create new chat\n");
  await page.screenshot({ path: "debug-new-chat-failed.png" });
  throw new Error("Could not create new chat");
}

/**
 * Method 1: Keyboard shortcut
 */
async function tryKeyboardShortcut(page: Page): Promise<boolean> {
  try {
    const urlBefore = page.url();
    logger.debug(`  Current URL: ${urlBefore}`);

    const isMac = process.platform === "darwin";
    const modKey = isMac ? "Meta" : "Control";
    
    logger.debug(`  Pressing: ${modKey}+Shift+O`);

    // Press shortcut
    await page.keyboard.down(modKey);
    await page.keyboard.down("Shift");
    await page.keyboard.press("KeyO");
    await page.keyboard.up("Shift");
    await page.keyboard.up(modKey);

    // Wait for effect
    await page.waitForTimeout(2000);

    const urlAfter = page.url();
    logger.debug(`  New URL: ${urlAfter}`);

    // Check if URL changed to root
    const urlChanged = urlAfter !== urlBefore;
    const isRootUrl = urlAfter === "https://chatgpt.com/" || 
                      urlAfter === "https://chat.openai.com/" ||
                      (urlAfter.includes("chatgpt.com") && !urlAfter.includes("/c/"));

    if (urlChanged && isRootUrl) {
      logger.debug("  ✓ URL changed to root/new chat");
      
      // Verify chat is actually empty
      const isEmpty = await isChatEmpty(page);
      if (isEmpty) {
        logger.debug("  ✓ Chat is empty - confirmed new chat");
        return true;
      }
      logger.debug("  ✗ Chat has content - not a new chat");
    } else {
      logger.debug("  ✗ URL didn't change or not root URL");
    }

    return false;
  } catch (err: any) {
    logger.error(`  Error: ${err.message}`);
    return false;
  }
}

/**
 * Method 2: Click new chat button
 */
async function tryClickButtons(page: Page): Promise<boolean> {
  const selectors = [
    'button:has-text("New chat")',
    'a:has-text("New chat")',
    'a[href="/"]',
    '[data-testid="new-chat-button"]',
    'button[aria-label*="New chat" i]',
  ];

  logger.debug(`  Trying ${selectors.length} button selectors...`);

  for (const selector of selectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      if (count === 0) {
        logger.debug(`  - ${selector}: Not found`);
        continue;
      }

      const firstEl = elements.first();
      const isVisible = await firstEl.isVisible().catch(() => false);

      if (!isVisible) {
        logger.debug(`  - ${selector}: Found but not visible`);
        continue;
      }

      logger.debug(`  - ${selector}: Found and visible, clicking...`);

      const urlBefore = page.url();
      await firstEl.click({ timeout: 5000 });
      await page.waitForTimeout(2000);

      const urlAfter = page.url();
      const urlChanged = urlAfter !== urlBefore;

      logger.debug(`    URL before: ${urlBefore}`);
      logger.debug(`    URL after: ${urlAfter}`);

      if (urlChanged || await isChatEmpty(page)) {
        logger.debug(`  ✓ Click successful!`);
        return true;
      }

      logger.debug(`  ✗ Click had no effect`);
    } catch (err: any) {
      logger.debug(`  - ${selector}: Error - ${err.message}`);
    }
  }

  logger.debug("  ✗ No working button found");
  return false;
}

/**
 * Check if chat is empty (no messages)
 */
async function isChatEmpty(page: Page): Promise<boolean> {
  try {
    // Check for message elements
    const messageSelectors = [
      '[data-message-author-role="assistant"]',
      '[data-message-author-role="user"]',
      '[data-testid*="conversation-turn"]',
      'article[data-testid]',
    ];

    for (const selector of messageSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        logger.debug(`    Found ${count} message(s) with selector: ${selector}`);
        return false;
      }
    }

    // Verify input exists and is empty
    const inputSelectors = [
      'textarea[data-id="root"]',
      'textarea[placeholder*="Message"]',
      'textarea',
      '[contenteditable="true"]',
    ];

    for (const selector of inputSelectors) {
      const input = page.locator(selector).first();
      const count = await input.count();

      if (count > 0) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          const isEmpty = await input.evaluate((el) => {
            if (el instanceof HTMLTextAreaElement) {
              return !el.value || el.value.trim().length === 0;
            }
            if (el instanceof HTMLElement && el.isContentEditable) {
              return !el.textContent || el.textContent.trim().length === 0;
            }
            return true;
          });

          logger.debug(`    Input found (${selector}), empty: ${isEmpty}`);
          return isEmpty;
        }
      }
    }

    logger.debug("    No input found");
    return false;
  } catch (err) {
    logger.debug(`    Error checking if empty: ${err}`);
    return false;
  }
}

/**
 * Safe wrapper that doesn't throw
 */
export async function ensureNewChatSafe(page: Page): Promise<boolean> {
  try {
    await ensureNewChat(page);
    return true;
  } catch (err: any) {
    logger.debug("❌ Error creating new chat:", err.message);
    return false;
  }
}