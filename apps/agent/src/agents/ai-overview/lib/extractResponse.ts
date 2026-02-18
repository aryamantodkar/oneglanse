import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

// Returns cleaned HTML for the AI Overview section - markdown conversion is done by extractAssistantMarkdown
export async function extractAIOverviewResponse(page: Page): Promise<string> {
    try {
      const result = await page.evaluate(() => {
        const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
        let aoHeading = null;
  
        for (const heading of headings) {
          if (heading.textContent?.toLowerCase().includes('ai overview')) {
            aoHeading = heading;
            break;
          }
        }
  
        if (!aoHeading) {
          return { success: false, error: 'AI Overview heading not found' };
        }
  
        let contentElement = aoHeading.parentElement;
  
        for (let i = 0; i < 8; i++) {
          if (!contentElement) break;
          const innerText = contentElement.innerText || '';
          // FIX: removed hardcoded 'Key Considerations' sentinel, length check is enough
          if (innerText.length > 500) {
            break;
          }
          contentElement = contentElement.parentElement;
        }
  
        if (!contentElement) {
          return { success: false, error: 'AI Overview content container not found' };
        }
  
        const clone = contentElement.cloneNode(true) as HTMLElement;
  
        // Remove "Dive deeper in AI Mode" section
        const diveDeeper = Array.from(clone.querySelectorAll('*')).find(
          el => el.textContent?.includes('Dive deeper in AI Mode')
        );
        if (diveDeeper) {
          let parent = diveDeeper.parentElement;
          while (parent && parent !== clone) {
            if (parent.parentElement === clone) {
              parent.remove();
              break;
            }
            parent = parent.parentElement;
          }
        }
  
        // Remove web result cards
        const webCards = clone.querySelectorAll('[data-testid], .web-result-card, .search-result');
        webCards.forEach(card => {
          const text = card.textContent || '';
          // FIX: replaced broad /\\d{4}/ (matched code/versions) with a specific month+year date pattern
          if (/\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{4}\\b/.test(text) && text.length < 300) {
            card.remove();
          }
        });
  
        // Remove language selector and navigation
        const navElements = clone.querySelectorAll('[aria-label*="language"], [role="navigation"]');
        navElements.forEach(el => el.remove());
  
        return { success: true, html: clone.innerHTML };
      });
  
      if (!result.success) {
        logger.warn(`AI Overview extraction failed: ${result.error}`);
        return "";
      }
  
      const html = result.html || "";
      logger.debug(`✅ Extracted AI Overview HTML (${html.length} chars)`);
      return html;
  
    } catch (error: any) {
      logger.error(`AI Overview extraction error: ${error.message}`);
      return "";
    }
  }
  