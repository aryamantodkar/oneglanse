import { Page } from "playwright";
import { isPerplexityAuthenticated } from "./validateAuth.js";
import { checkPageStability } from "../../../lib/browser/checkPageStability.js";
import { logger } from "../../../lib/utils/logger.js";

export async function waitForPerplexityAuthentication(
    page: Page,
    timeoutMs = 8 * 60 * 1000
  ): Promise<void> {
    logger.debug("🔐 Waiting for Perplexity authentication…");

    await page.waitForTimeout(2000);
  
    const deadline = Date.now() + timeoutMs;
  
    while (Date.now() < deadline) {
      await checkPageStability(page);
  
      if (await isPerplexityAuthenticated(page)) {
        logger.debug("✅ Perplexity session detected");
        return;
      }
      await page.waitForTimeout(2000);
    }

    logger.debug("❌ Perplexity login timed out");
  }