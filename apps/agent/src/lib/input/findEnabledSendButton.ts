import { SUBMIT_BTN_SELECTORS } from "@onescope/utils";
import { Locator, Page } from "playwright";
import { logger } from "../utils/logger.js";

export async function findEnabledSendButton(page: Page): Promise<Locator | null> {
    for (const selector of SUBMIT_BTN_SELECTORS) {
      const buttons = page.locator(selector);
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i);
        try {
          if (
            (await btn.isVisible()) &&
            (await btn.isEnabled())
          ) {
            logger.debug(`Found send button with selector: ${selector}`);
            return btn;
          }
        } catch {}
      }
    }

    // Debug: Log what buttons are actually on the page
    const allButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim().slice(0, 20),
        ariaLabel: btn.getAttribute('aria-label'),
        type: btn.getAttribute('type'),
        disabled: (btn as HTMLButtonElement).disabled,
        visible: btn.offsetParent !== null,
      })).slice(0, 10);
    }).catch(() => []);

    logger.warn(`No send button found. Available buttons: ${JSON.stringify(allButtons, null, 2)}`);
    return null;
  }