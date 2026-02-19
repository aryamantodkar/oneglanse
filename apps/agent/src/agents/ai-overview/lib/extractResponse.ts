import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
    try {
      const result = await page.evaluate(() => {
        // Target the exact AI Overview response container
        const container = document.querySelector('[data-container-id="model-response-placeholder"]');
        if (!container) return { success: false, error: 'model-response-placeholder not found' };
  
        const responseDiv = container.querySelector('[data-hveid]');
        if (!responseDiv) return { success: false, error: 'response div not found' };
  
        const proseDiv = responseDiv.children[0] as HTMLElement;
        if (!proseDiv) return { success: false, error: 'prose div not found' };
  
        // Clone to avoid mutating live DOM
        const clone = proseDiv.cloneNode(true) as HTMLElement;
  
        // Remove noise tags
        ['script', 'style', 'button', 'svg', 'noscript', 'iframe'].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
  
        // Remove citation superscripts
        clone.querySelectorAll('sup').forEach(el => el.remove());
  
        // Remove source card ULs — identified by date pattern "DD Mon YYYY —"
        clone.querySelectorAll('ul').forEach(ul => {
          if (/\\d{1,2} \\w+ \\d{4} —/.test(ul.textContent || '')) ul.remove();
        });
  
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