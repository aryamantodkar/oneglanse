import type { Page } from "playwright";
import type { Source } from "@onescope/types";
import { logger } from "../../../lib/utils/logger.js";

export async function extractGoogleOverviewSources(page: Page): Promise<Source[]> {
  try {
    const sources = await page.evaluate(() => {
      const results: any[] = [];
      const seen = new Set<string>();

      try {
        // For Google AI Mode, sources are in list items below the response
        // But we need to filter out navigation items
        
        const listItems = document.querySelectorAll('[role="listitem"], li, listitem');
        console.log(`Found ${listItems.length} list items`);

        for (const item of listItems) {
          // Each source card has a link with the title
          const link = item.querySelector('a[href]');
          if (!link) continue;

          const url = (link as HTMLAnchorElement).href;

          // Skip Google internal links, navigation items, and non-HTTP links
          if (!url || !url.startsWith('http') || 
              url.includes('google.com/search') || 
              url.includes('google.com/url') ||
              url.includes('google.com/webhp') ||
              url.includes('maps.google.com') ||
              url.includes('google.com/travel') ||
              url.includes('google.com/finance')) {
            continue;
          }

          // Avoid duplicates
          if (seen.has(url)) continue;
          seen.add(url);

          // Extract title from the link text
          // In AI Mode, the title is usually the main link text
          let title = (link as HTMLElement).textContent?.trim() || '';
          
          // If title is too short or empty, look for nearby text
          if (title.length < 10) {
            // Look for generic elements or headings near the link
            const parent = link.closest('[role="listitem"], li, listitem') || link.parentElement;
            if (parent) {
              const generics = parent.querySelectorAll('generic, h3, h4');
              for (const gen of generics) {
                const text = (gen.textContent || '').trim();
                if (text.length > 10 && text.length < 200 && !text.includes('sites')) {
                  title = text;
                  break;
                }
              }
            }
          }

          // Skip if still no valid title
          if (!title || title.length < 10) continue;

          // Extract domain
          let domain: string | null = null;
          try {
            domain = new URL(url).hostname?.replace(/^www\\./, '') ?? null;
          } catch {
            domain = null;
          }

          // Extract cited text/description
          // Usually follows the title in the list item
          let citedText = '';
          const parent = link.closest('[role="listitem"], li, listitem') || link.parentElement;
          if (parent) {
            const allText = (parent as HTMLElement).innerText || '';
            
            // Split by title and get the description after it
            const parts = allText.split(title);
            if (parts.length > 1 && parts[1]) {
              // Get text after title, clean it up
              const afterTitle = parts[1].trim();
              // Extract first meaningful sentence (usually has a date prefix)
              const lines = afterTitle.split('\\n');
              for (const line of lines) {
                const cleaned = line.trim();
                // Look for description text (not just domain names or "About this result")
                if (cleaned.length > 30 && 
                    !cleaned.startsWith('http') && 
                    !cleaned.includes('About this result') &&
                    !cleaned.includes('Opens in new tab')) {
                  citedText = cleaned.substring(0, 300);
                  break;
                }
              }
            }
          }

          // Build favicon URL
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

          console.log(`Added source: ${title.substring(0, 50)}`);
        }

        console.log(`Total AI Mode sources extracted: ${results.length}`);
        return results;

      } catch (error) {
        console.error('Error in extractGoogleOverviewSources:', error);
        return results;
      }
    });

    logger.debug(`Extracted ${sources.length} sources from AI Mode`);
    return sources;

  } catch (err: any) {
    logger.error(`Failed to extract AI Mode sources: ${err.message}`);
    return [];
  }
}