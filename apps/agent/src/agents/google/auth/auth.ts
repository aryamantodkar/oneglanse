import { Page } from "playwright";
import { checkPageStability } from "../../../lib/browser/checkPageStability.js";
import { logger } from "../../../lib/utils/logger.js";
import { isGoogleAuthenticated } from "./validateAuth.js";

export async function waitForGoogleAuthentication(
    page: Page,
    timeoutMs: number = 8 * 60 * 1000 // 5 minutes
  ): Promise<void> {
    logger.debug("🔐 Waiting for Google login to complete…");
    
    await page.waitForTimeout(2000);
    
    const deadline = Date.now() + timeoutMs;
  
    while (Date.now() < deadline) {
      await checkPageStability(page);
  
      if (await isGoogleAuthenticated(page)) {
        logger.debug("✅ Google session detected");
        return;
      }
  
      await page.waitForTimeout(2000);
    }

    logger.debug("❌ Google login timed out");
  }