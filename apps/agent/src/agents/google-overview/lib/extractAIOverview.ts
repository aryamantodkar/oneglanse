import type { Page } from "playwright";
import TurndownService from "turndown";
import { logger } from "../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
  try {
    const result = await page.evaluate(() => {
      // Find AI Overview heading
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

      // Find content container (traverse up to find container with full content)
      let contentElement = aoHeading.parentElement;

      for (let i = 0; i < 8; i++) {
        if (!contentElement) break;
        const innerText = contentElement.innerText || '';
        // Look for content that includes full response
        if (innerText.includes('Key Considerations') || innerText.length > 500) {
          break;
        }
        contentElement = contentElement.parentElement;
      }

      if (!contentElement) {
        return { success: false, error: 'AI Overview content container not found' };
      }

      // Clone the container to avoid modifying the actual page
      const clone = contentElement.cloneNode(true) as HTMLElement;

      // Remove unwanted elements from the clone
      // 1. Remove "Dive deeper in AI Mode" section
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

      // 2. Remove web result cards (these typically have specific patterns)
      const webCards = clone.querySelectorAll('[data-testid], .web-result-card, .search-result');
      webCards.forEach(card => {
        const text = card.textContent || '';
        // Remove if it looks like a web result (has URL patterns, dates, "Topics", etc.)
        if (text.includes('Feb 2026') || text.includes('Topics') || /\d{4}/.test(text)) {
          card.remove();
        }
      });

      // 3. Clean up language selector and navigation
      const navElements = clone.querySelectorAll('[aria-label*="language"], [role="navigation"]');
      navElements.forEach(el => el.remove());

      // Return the cleaned HTML
      return { success: true, html: clone.innerHTML };
    });

    if (!result.success) {
      logger.warn(`AI Overview extraction failed: ${result.error}`);
      return "";
    }

    // Convert HTML to markdown using TurndownService
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Add custom rules for better formatting
    turndownService.addRule('removeEmptyParagraphs', {
      filter: (node) => {
        return node.nodeName === 'P' && !node.textContent?.trim();
      },
      replacement: () => '',
    });

    turndownService.addRule('preserveBreaks', {
      filter: ['br'],
      replacement: () => '\n',
    });

    const markdown = turndownService.turndown(result.html || "");

    // Post-process markdown
    const cleaned = markdown
      .replace(/^AI overview\s*AI Overview\s*मराठी\s*/i, '# AI Overview\n\n')
      .replace(/View all\s*/g, '')
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();

    logger.debug(`✅ Extracted AI Overview response (${cleaned.length} chars)`);
    return cleaned;

  } catch (error: any) {
    logger.error(`AI Overview extraction error: ${error.message}`);
    return "";
  }
}
