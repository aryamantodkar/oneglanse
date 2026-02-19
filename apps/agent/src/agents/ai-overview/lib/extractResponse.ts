import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
    try {
      const result = await page.evaluate(() => {
  
        const SOURCE_CARD_DATE_PATTERN = new RegExp(
          '(' +
          '[A-Z][a-z]+ \\\\d{1,2}, \\\\d{4}' +                          // "May 27, 2025"
          '|\\\\d{1,2} [A-Z][a-z]+ \\\\d{4}' +                          // "27 Apr 2017"
          '|\\\\d+ (second|minute|hour|day|week|month|year)s? ago' +   // "3 days ago"
          '|[Yy]esterday' +                                           // "Yesterday"
          '|\\\\b\\\\d{4}\\\\b (?:—|·)' +                                  // "2025 —" / "2025 ·"
          ')'
        );
  
        const placeholder = document.querySelector('[data-container-id="model-response-placeholder"]');
        if (!placeholder) return { success: false, error: 'model-response-placeholder not found' };
  
        // Clone the FULL placeholder — so rhs-col is always present and always removable
        const clone = placeholder.cloneNode(true) as HTMLElement;
  
        // Step 1: Remove noise tags
        ['script', 'style', 'button', 'svg', 'noscript', 'iframe'].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
        clone.querySelectorAll('sup').forEach(el => el.remove());
  
        // Step 2: ALWAYS remove rhs-col — guaranteed to work since we cloned placeholder
        clone.querySelectorAll('[data-container-id="rhs-col"]').forEach(el => el.remove());
  
        // Step 3: Remove known source card / corroboration UI selectors
        [
          '[data-xid="aim-aside-initial-corroboration-container"]',
          'ul.bTFeG',
          'ul.EJw9bc',
          '.HWMcu',
          '.BTkBWc',
        ].forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));
  
        // Step 4: Remove any remaining source card date-pattern elements
        clone.querySelectorAll('ul, ol, div, li').forEach(el => {
          if (
            (el.textContent || '').length < 5000 &&
            SOURCE_CARD_DATE_PATTERN.test(el.textContent || '')
          ) {
            el.remove();
          }
        });
  
        // Step 5: Extract main-col prose (fallback to full cleaned clone if main-col absent)
        const mainCol = clone.querySelector('[data-container-id="main-col"]');
        const html = (mainCol || clone).outerHTML.trim();
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