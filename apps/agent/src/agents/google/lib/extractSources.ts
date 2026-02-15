import { Source } from "@onescope/types";
import { Page } from "playwright";

  export async function extractSourcesFromGoogle(page: Page): Promise<Source[]> {
    const sources = await page.evaluate(() => {  
      const results: Source[] = [];
      const seen = new Set<string>();
  
      // Find the response container
      const messageContent = document.querySelector('message-content');

      if (!(messageContent instanceof HTMLElement)) return false;
      if (!messageContent) return results;
  
      // Get all HTTP links in the response
      const allLinks = Array.from(
        messageContent.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')
      );
      if (allLinks.length === 0) return results;
  
      // Get full response text to parse citations
      const fullText = messageContent.innerText || '';
  
      // Check if there's a References section
      const hasReferences = fullText.includes('References');
      if (!hasReferences) return results;
  
      // Extract text after "References" heading
      const parts = fullText.split('References');
      // Ensure referencesText is always a string, avoid possible undefined
      const referencesText = parts && parts.length > 1 && typeof parts[parts.length - 1] === 'string'
        ? parts[parts.length - 1]
        : '';
      const citationLines = (referencesText ?? '').split('\n').filter((l) => l.trim().length > 10);

      // Process each link
      for (const link of allLinks) {
        let href = link.getAttribute('href');
        if (!href) continue;
  
        // Handle Google search redirects (Gemini wraps some URLs)
        if (href.includes('google.com/search?q=')) {
          const urlMatch = href.match(/[?&]q=([^&]+)/);
          if (urlMatch && urlMatch[1] !== undefined) {
            try {
              href = decodeURIComponent(urlMatch[1]);
            } catch {
              href = urlMatch[1] ?? null;
            }
          }
        }
  
        // Normalize URL
        try {
          href = new URL(href, window.location.origin).toString();
        } catch {
          continue;
        }
  
        // Extract domain
        const domain = (() => {
          try {
            return new URL(href).hostname.replace(/^www\\./, '');
          } catch {
            return null;
          }
        })();
  
        // Find citation line containing this link
        const linkText = link.textContent?.trim() || '';
        const citationLine = citationLines.find((line) => line.includes(linkText));
  
        // Parse citation for title and authors
        let title = '';
        let citedText = '';
  
        if (citationLine) {
          // Remove the URL to get citation metadata
          const withoutUrl = citationLine.replace(linkText, '').trim();
  
          // Parse citation format: "Authors (Year). Title. Journal/Source."
          const citationParts = withoutUrl.split('.');
  
          if (citationParts?.length >= 2) {
            // First part is usually authors + year
            const authorsYear = citationParts[0]?.trim() ?? '';
            // Second part is usually the title
            title = citationParts[1]?.trim() || authorsYear;
            // Store authors as cited text
            citedText = authorsYear;
          } else {
            title = withoutUrl || domain || href;
          }
  
          // Fallback: use citation line as title if parsing failed
          if (!title || title.length < 3) {
            title = citationLine.substring(0, 150).trim();
          }
        } else {
          // No citation found, use domain or URL
          title = domain || href;
        }
  
        // Generate favicon
        const favicon = domain
          ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
          : null;
  
        // Deduplicate
        const key = `${href}|${title}`;
        if (seen.has(key)) continue;
        seen.add(key);
  
        results.push({
          title,
          cited_text: citedText,
          url: href,
          domain,
          favicon,
        });
      }
  
      return results;
    });
  
    return Array.isArray(sources) ? sources : [];
  }