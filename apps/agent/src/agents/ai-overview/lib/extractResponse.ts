import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
    try {
      const result = await page.evaluate(() => {
        // Target only the prose column — excludes source cards (rhs-col) entirely
        const mainCol = document.querySelector(
          '[data-container-id="model-response-placeholder"] [data-container-id="main-col"]'
        );
        if (!mainCol) return { success: false, error: 'main-col not found' };
  
        // Clone to avoid mutating live DOM
        const clone = mainCol.cloneNode(true) as HTMLElement;
  
        // Remove noise tags
        ['script', 'style', 'button', 'svg', 'noscript', 'iframe'].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
  
        // Remove citation superscripts
        clone.querySelectorAll('sup').forEach(el => el.remove());
  
        const html = clone.outerHTML.trim();
        if (!html) return { success: false, error: 'AI Overview HTML was empty after extraction' };
  
        return { success: true, html };
      });
  
      if (!result || !result.success) {
        logger.warn(`AI Overview extraction failed: ${result?.error}`);
        return '';
      }
  
      const html = result.html || '';
      logger.debug(`✅ Extracted AI Overview HTML (${html.length} chars)`);
      return html;
  
    } catch (error: any) {
      logger.error(`AI Overview extraction error: ${error.message}`);
      return '';
    }
  }