import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
    try {
      const result = await page.evaluate(() => {
        const placeholder = document.querySelector('[data-container-id="model-response-placeholder"]');
        if (!placeholder) return { success: false, error: 'model-response-placeholder not found' };
  
        // Layout A: main-col exists (prose is separate from source cards)
        // Layout B: no main-col — prose and source cards are in same container
        const mainCol = placeholder.querySelector('[data-container-id="main-col"]');
        const targetEl = (mainCol || placeholder.querySelector('[data-hveid]')?.children[0]) as HTMLElement | null;
        if (!targetEl) return { success: false, error: 'response element not found' };
  
        const clone = targetEl.cloneNode(true) as HTMLElement;
  
        // Step 1: Remove noise tags
        ['script', 'style', 'button', 'svg', 'noscript', 'iframe'].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
        clone.querySelectorAll('sup').forEach(el => el.remove());
  
        // Step 2: Remove rhs-col (source card column) if nested inside
        clone.querySelectorAll('[data-container-id="rhs-col"]').forEach(el => el.remove());
  
        // Step 3: Remove all known source card / corroboration UI elements by class/attr
        [
          '[data-xid="aim-aside-initial-corroboration-container"]',
          'ul.bTFeG',
          'ul.EJw9bc',
          '.HWMcu',
          '.BTkBWc',
        ].forEach(sel => {
          clone.querySelectorAll(sel).forEach(el => el.remove());
        });
  
        // Step 4: Safety net — remove any element whose text matches the source card date pattern
        // e.g. "Best CRM Software - PCMag\\nJan 16, 2026 — Bigin by Zoho..."
        // Only targets small containers (<5000 chars) to avoid removing the whole prose block
        clone.querySelectorAll('ul, ol, div').forEach(el => {
          if (
            (el.textContent || '').length < 5000 &&
            /\\d{1,2} \\w+ \\d{4} —/.test(el.textContent || '')
          ) {
            el.remove();
          }
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