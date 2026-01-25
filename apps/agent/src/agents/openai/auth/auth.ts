import { Page } from "playwright";
import { isOpenaiAuthenticated } from "./validateAuth.js";
import { checkPageStability } from "../../../lib/browser/checkPageStability.js";
import { logger } from "../../../lib/utils/logger.js";

export async function waitForOpenaiAuthentication(
    page: Page,
    timeoutMs: number = 8 * 60 * 1000 // 5 minutes
  ): Promise<void> {  
    logger.debug("🔐 Waiting for ChatGPT login to complete…");
  
    await page.waitForTimeout(2000);
    
    const deadline = Date.now() + timeoutMs;
  
    while (Date.now() < deadline) {
      await checkPageStability(page);
  
      if (await isOpenaiAuthenticated(page)) {
        logger.debug("✅ ChatGPT session detected");
        return;
      }
  
      await page.waitForTimeout(2000);
    }

    logger.debug("❌ Openai login timed out");
  }
  