import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

/**
 * Extracts the cleaned HTML from Google AI Mode response
 * The HTML is converted to markdown by the shared turndown service in extractAssistantMarkdown.ts
 */
export async function extractAIOverviewResponse(page: Page): Promise<string> {
  try {
    const result = await page.evaluate(() => {
      // Find the AI Mode response container
      const allDivs = Array.from(document.querySelectorAll('div'));
      let responseDiv: HTMLElement | null = null;
      let maxTextLength = 0;

      for (const div of allDivs) {
        const text = (div.textContent || '').trim();
        const innerText = (div.innerText || '').trim();

        // Skip huge containers (entire page)
        const childDivs = div.querySelectorAll('div');
        if (childDivs.length > 100) continue;

        // Skip navigation, banners, dialogs
        const role = div.getAttribute('role');
        if (role === 'navigation' || role === 'banner' || role === 'contentinfo' || role === 'dialog') continue;

        // Skip common UI elements and history sidebar
        if (text.includes('Accessibility links') ||
            text.includes('Sign in') ||
            text.includes('Settings') ||
            text.includes('Search settings') ||
            text.includes('Start a new thread') ||  // History sidebar
            text.includes('Delete all searches') ||  // History sidebar
            text.includes('Turn on your Visual Search') ||  // Modal
            text.includes('My Google Search History') ||  // History sidebar
            text.includes('Ask anything')) continue;  // Input box

        // Look for substantial content (actual response)
        if (innerText.length > 500 && innerText.length < 10000) {
          // Prefer more focused content over larger containers
          if (innerText.length > maxTextLength) {
            maxTextLength = innerText.length;
            responseDiv = div;
          }
        }
      }

      if (!responseDiv) {
        return { success: false, error: 'AI Mode response container not found' };
      }

      // Clone the container to avoid modifying the actual page
      const clone = responseDiv.cloneNode(true) as HTMLElement;

      // Remove unwanted elements from the clone
      // 1. Remove all buttons
      const buttons = clone.querySelectorAll('button');
      buttons.forEach(btn => btn.remove());

      // 2. Remove dialogs and modals
      const dialogs = clone.querySelectorAll('dialog, [role="dialog"]');
      dialogs.forEach(d => d.remove());

      // 3. Remove navigation elements
      const navElements = clone.querySelectorAll('nav, [role="navigation"]');
      navElements.forEach(el => el.remove());

      // 4. Remove the sources list (we extract it separately)
      const sourcesElements = clone.querySelectorAll('[role="list"], list, ul, ol');
      sourcesElements.forEach(el => {
        // Only remove if it contains multiple source links
        const links = el.querySelectorAll('a[href]');
        if (links.length > 2) {
          el.remove();
        }
      });

      // 5. Remove icons and images (keep favicons might be in sources)
      const images = clone.querySelectorAll('img:not([alt])');
      images.forEach(img => img.remove());

      // 6. Remove status/aria-live elements
      const ariaLive = clone.querySelectorAll('[aria-live]');
      ariaLive.forEach(el => el.remove());

      // Return the cleaned HTML
      return { success: true, html: clone.innerHTML };
    });

    if (!result.success) {
      logger.warn(`AI Mode extraction failed: ${result.error}`);
      return "";
    }

    // Return cleaned HTML - the shared turndown service in extractAssistantMarkdown.ts
    // will handle conversion to markdown with all custom rules (images, videos, tables, etc.)
    const html = result.html || "";
    logger.debug(`✅ Extracted AI Mode HTML (${html.length} chars)`);
    return html;

  } catch (error: any) {
    logger.error(`AI Mode extraction error: ${error.message}`);
    return "";
  }
}