import { Page } from "playwright";
import { pageHealthCheck } from "../../../lib/browser/pageHealthCheck.js";

export async function isPerplexityAuthenticated(page: Page): Promise<boolean> {
  if (!page.url().startsWith("https://www.perplexity.ai")) return false;

  // Wait for page to be interactive (reduced timeout for faster auth)
  await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});

  // Check for UI elements with retry logic (faster retries)
  let hasProfileUI = false;
  for (let i = 0; i < 3; i++) {
    hasProfileUI = await page.evaluate(() => {
      // User avatar (strongest signal)
      if (document.querySelector('img[alt="User avatar"]')) {
        return true;
      }

      // Account dropdown trigger
      if (
        document.querySelector('[aria-haspopup="menu"][data-state]') &&
        document.querySelector('button img')
      ) {
        return true;
      }

      // Account label under avatar
      const accountLabel = Array.from(document.querySelectorAll("div"))
        .some(el => el.textContent?.trim() === "Account");

      return accountLabel;
    });

    if (hasProfileUI) break;

    // Faster retry delay (reduced from 2000ms to 500ms)
    await page.waitForTimeout(500);
  }

  if (!hasProfileUI) return false;

  // Deep page health check — catches bot detection, CAPTCHAs, rate limits
  const health = await pageHealthCheck(page, "perplexity");
  return health.healthy;
}