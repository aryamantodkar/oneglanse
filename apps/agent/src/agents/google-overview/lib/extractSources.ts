import type { Page } from "playwright";
import type { Source } from "@onescope/types";
import { logger } from "../../../lib/utils/logger.js";

export async function extractGoogleOverviewSources(page: Page): Promise<Source[]> {
  try {
    const sources = await page.evaluate(() => {
      const results: any[] = [];
      const seen = new Set<string>();

      try {
        // Step 1: Find the AI Overview container
        let aoContainer: HTMLElement | null = null;

        // Method 1: Find by heading text
        const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
        for (const heading of headings) {
          if (heading.textContent?.toLowerCase().includes('ai overview')) {
            // Traverse up to find the container with content
            let current: HTMLElement | null = heading.parentElement;
            for (let i = 0; i < 8; i++) {
              if (!current) break;

              // Check if this element contains the full AI Overview content
              const innerText = current.innerText || '';
              if (innerText.length > 500) {
                aoContainer = current;
                break;
              }
              current = current.parentElement;
            }
            break;
          }
        }

        // Method 2: Find by generic container (if Method 1 failed)
        if (!aoContainer) {
          const allDivs = document.querySelectorAll('[role="region"], main > div, [data-sokoban-container]');
          for (const div of allDivs) {
            if (!(div instanceof HTMLElement)) continue;
            const text = div.innerText || '';
            if (text.includes('AI overview') && text.length > 500) {
              aoContainer = div;
              break;
            }
          }
        }

        if (!aoContainer) {
          console.error('AI Overview container not found');
          return results;
        }

        console.log('AI Overview container found');

        // Step 2: Get all links within ONLY this container
        const linksInAO = aoContainer.querySelectorAll('a[href]');
        console.log(`Found ${linksInAO.length} links in AI Overview`);

        // Step 3: Extract each link with context
        for (const link of linksInAO) {
          try {
            // Make sure we are working with HTMLAnchorElement for .href property
            if (!(link instanceof HTMLAnchorElement)) continue;
            const url = link.href;

            // Skip Google internal links
            if (url.includes('google.com/search') || url.includes('google.com/')) {
              continue;
            }

            const key = url;
            if (seen.has(key)) continue;
            seen.add(key);

            // Extract domain
            let domain: string | null = null;
            try {
              domain = new URL(url).hostname?.replace(/^www\\./, '') ?? null;
            } catch {
              domain = null;
            }

            // Get link title/text
            let title = link.textContent?.trim() || '';
            if (!title) {
              title = domain || url;
            }

            // Get surrounding context as cited text
            let citedText = '';

            // Try to find the paragraph or container this link is in
            let textNode: ChildNode | null = link.previousSibling;
            while (textNode) {
              if (textNode.nodeType === Node.TEXT_NODE) {
                const text = textNode.textContent?.trim();
                if (text && text.length > 10) {
                  citedText = text.substring(0, 150);
                  break;
                }
              } else if (textNode instanceof HTMLElement) {
                const text = textNode.textContent?.trim();
                if (text && text.length > 10) {
                  citedText = text.substring(0, 150);
                  break;
                }
              }
              textNode = textNode.previousSibling;
            }

            // If no preceding text, look at the paragraph containing the link
            if (!citedText) {
              const paragraph = link.closest('li, p, div[role="paragraph"]');
              if (paragraph) {
                citedText = paragraph.textContent?.trim().substring(0, 200) || '';
              }
            }

            // Fallback to title/domain
            if (!citedText) {
              citedText = title;
            }

            // Build favicon
            const favicon = domain
              ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
              : null;

            results.push({
              title: title.substring(0, 200),
              cited_text: citedText,
              url: url,
              domain: domain,
              favicon: favicon,
            });

            console.log(`Added: ${title}`);
          } catch (error) {
            console.warn('Error processing link:', error);
            continue;
          }
        }

        console.log(`Total AI Overview sources extracted: ${results.length}`);
        return results;
      } catch (error) {
        console.error('Error in extractAIOverviewSources:', error);
        return results;
      }
    });

    logger.debug(`Extracted ${sources.length} sources from AI Overview`);
    return sources;

  } catch (err: any) {
    logger.error(`Failed to extract AI Overview sources: ${err.message}`);
    return [];
  }
}
