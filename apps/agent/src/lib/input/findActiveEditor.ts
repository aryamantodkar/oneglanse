import { Page, Locator } from "playwright";
import { EDITOR_SELECTORS } from "../utils/constants.js";
import { Provider } from "../../types/types.js";
import { logger } from "../utils/logger.js";

export async function findActiveEditor(page: Page): Promise<Locator> {
    for (const selector of EDITOR_SELECTORS) {
      const nodes = page.locator(selector);
  
      const count = await nodes.count();
      for (let i = 0; i < count; i++) {
        const el = nodes.nth(i);
  
        try {
          if (await el.isVisible()) {
            await el.focus().catch(() => {});

            logger.log(`  ✓ Found input: ${selector}`);
            return el;
          }
        } catch {
          logger.log(`  ⚠️  Found but hidden: ${selector}`);
        }
      }
    }

    throw new Error("❌ No active prompt editor found");
}

export async function waitForEditorReady(
  page: Page,
  provider: Provider
): Promise<Locator> {
  const start = Date.now();
  const TIMEOUT = 30000;

  while (Date.now() - start < TIMEOUT) {
    const input = await findActiveEditor(page).catch(() => null);
    if (!input) {
      await page.waitForTimeout(200);
      continue;
    }

    const ready = await input.evaluate(el => {
      if (!(el instanceof HTMLElement)) return false;
      if (!el.isConnected) return false;
      if (el.getAttribute("contenteditable") !== "true") return false;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      // Can we actually mutate it?
      const before = el.innerText;
      el.innerText = "█";
      const ok = el.innerText.includes("█");
      el.innerText = before;

      return ok;
    }).catch(() => false);

    if (ready) return input;

    await page.waitForTimeout(200);
  }

  throw new Error(`Editor not ready for ${provider}`);
}