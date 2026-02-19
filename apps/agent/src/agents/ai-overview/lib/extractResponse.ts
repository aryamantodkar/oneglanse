import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

// Returns cleaned HTML for the AI Overview section - markdown conversion is done by extractAssistantMarkdown
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
  
        if (!aoHeading) {
          return { success: false, error: 'AI Overview heading not found' };
        }
  
        // Walk UP to find the container with enough text content
        let contentElement = aoHeading.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!contentElement) break;
          const innerText = contentElement.innerText || '';
          if (innerText.length > 500) break;
          contentElement = contentElement.parentElement;
        }
  
        if (!contentElement) {
          return { success: false, error: 'AI Overview content container not found' };
        }
  
        // ✅ FIX 1: Use innerText instead of innerHTML
        //    innerHTML is 140x larger — it contains CSS, hidden elements, citation JSON.
        let text = contentElement.innerText || '';
  
        // ✅ FIX 5: Remove the duplicate "AI overview / AI Overview" heading lines
        text = text.replace(/^AI overview\\s*/i, '').replace(/^AI Overview\\s*/i, '').trim();
  
        // ✅ FIX: Remove the "+N" citation badge (e.g. "+1", "+3") at the start
        text = text.replace(/^\\+\\d+\\s*/, '').trim();
  
        // ✅ FIX: Remove "Dive deeper in AI Mode" and everything after it
        const diveIdx = text.indexOf('Dive deeper in AI Mode');
        if (diveIdx !== -1) text = text.substring(0, diveIdx).trim();
  
        // ✅ FIX 3: Remove source card snippets.
        //    Google's source cards appear after the summary as:
        //    "Site Name\\nArticle Title\\nBlurb...\\nSite Name\\n..."
        //    The summary ends at the first blank line followed by a short domain-like token.
        //    Simpler: just take text up to the first source domain line (short line after a period).
        const lines = text.split('\\n');
        const summaryLines: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          // Source card lines are short (domain names, "+N" counters) following the summary
          // Stop when we hit a very short line after already collecting substantial content
          if (summaryLines.join(' ').length > 200 && trimmed.length < 50 && trimmed.length > 0 && !trimmed.endsWith('.')) {
            break;
          }
          summaryLines.push(line);
        }
        text = summaryLines.join('\\n').trim();
  
        if (!text) {
          return { success: false, error: 'AI Overview text was empty after extraction' };
        }
  
        return { success: true, text };
      });
  
      if (!result.success) {
        logger.warn(`AI Overview extraction failed: ${result.error}`);
        return '';
      }
  
      const text = result.text || '';
      logger.debug(`✅ Extracted AI Overview text (${text.length} chars)`);
      return text;
  
    } catch (error: any) {
      logger.error(`AI Overview extraction error: ${error.message}`);
      return '';
    }
  }