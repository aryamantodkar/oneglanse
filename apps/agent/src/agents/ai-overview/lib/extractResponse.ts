import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

// Returns cleaned HTML for the AI Overview section — markdown conversion is done by extractAssistantMarkdown
export async function extractAIOverviewResponse(page: Page): Promise<string> {
    try {
      const result = await page.evaluate(() => {
        // Find the AI Overview heading
        const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
        let aoHeading: Element | null = null;
        for (const heading of headings) {
          if (heading.textContent?.toLowerCase().includes('ai overview')) {
            aoHeading = heading;
            break;
          }
        }
        if (!aoHeading) return { success: false, error: 'AI Overview heading not found' };
  
        // Walk UP to find the container with enough text content
        let contentElement = aoHeading.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!contentElement) break;
          const innerText = (contentElement as HTMLElement).innerText || '';
          if (innerText.length > 500) break;
          contentElement = contentElement.parentElement;
        }
        if (!contentElement) return { success: false, error: 'AI Overview content container not found' };
  
        // Clone to avoid mutating the live DOM
        const clone = contentElement.cloneNode(true) as HTMLElement;
  
        // Remove noise tags
        ['script', 'style', 'button', 'svg', 'noscript', 'iframe'].forEach(tag => {
          clone.querySelectorAll(tag).forEach(el => el.remove());
        });
  
        // Remove citation superscripts
        clone.querySelectorAll('sup').forEach(el => el.remove());
  
        // Remove the "AI Overview" heading itself
        for (const h of clone.querySelectorAll('h1, h2, h3, [role="heading"]')) {
          if (h.textContent?.toLowerCase().includes('ai overview')) {
            h.remove();
            break;
          }
        }
  
        // ✅ FIX 1: Remove UI chrome elements (Save, Share, Ad Centre, etc.)
        clone.querySelectorAll('div, span, a').forEach(el => {
          const t = (el.textContent || '').trim();
          if (/^(save to google drive|save to gmail|share|my ad centre|feedback|report|copy)$/i.test(t)) {
            el.remove();
          }
        });
  
        // ✅ FIX 2: Remove source card ULs — identified by date pattern "DD Mon YYYY —"
        clone.querySelectorAll('ul').forEach(ul => {
          if (/\\d{1,2} \\w+ \\d{4} —/.test(ul.textContent || '')) {
            ul.remove();
          }
        });
  
        // ✅ FIX 3: Remove export consent tooltip paragraphs
        clone.querySelectorAll('p, div').forEach(el => {
          if ((el.textContent || '').trim().startsWith('When you export, you will allow Google Search')) {
            el.remove();
          }
        });
  
        // ✅ FIX 4: Remove "Dive deeper in AI Mode" and everything after it
        // Bugfix: walk up only while the node is the sole child at its level,
        // stopping before reaching a direct child of clone (to avoid deleting all prose)
        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        let diveNode: Node | null = null;
        while (walker.nextNode()) {
          if (walker.currentNode.textContent?.includes('Dive deeper in AI Mode')) {
            diveNode = walker.currentNode;
            break;
          }
        }
        if (diveNode) {
          let target: Node | null = diveNode;
          while (
            target &&
            target.parentElement !== clone &&
            target.parentNode &&
            (target.parentNode as Element).childElementCount === 1
          ) {
            target = target.parentElement;
          }
          if (target && target.parentElement !== clone) {
            let sibling: Node | null = target;
            while (sibling) {
              const next: Node | null = sibling.nextSibling;
              sibling.parentNode?.removeChild(sibling);
              sibling = next;
            }
          }
        }
  
        // Remove "+N" citation badge
        for (const child of clone.children) {
          if (/^\\+\\d+$/.test((child as HTMLElement).innerText?.trim() || '')) {
            child.remove();
            break;
          }
        }
  
        // Walk direct children to cut off remaining source-card sections
        const htmlParts: string[] = [];
        let totalTextLen = 0;
  
        for (const child of Array.from(clone.children)) {
          const childText = (child as HTMLElement).innerText || '';
          const allLinks = child.querySelectorAll('a[href]');
  
          let externalLinks = 0;
          for (const link of allLinks) {
            const href = (link as HTMLAnchorElement).href || '';
            if (href && !href.includes('google.com')) externalLinks++;
          }
  
          const linkDensity = allLinks.length > 0 ? childText.length / allLinks.length : Infinity;
  
          if (totalTextLen > 200 && externalLinks > 2 && linkDensity < 100) break;
  
          htmlParts.push((child as HTMLElement).outerHTML);
          totalTextLen += childText.length;
        }
  
        const html = htmlParts.join('').trim();
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