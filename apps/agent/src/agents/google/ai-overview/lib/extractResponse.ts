import type { Page } from "playwright";
import { logger } from "../../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
  try {
    const result = await page.evaluate(() => {
      const SOURCE_CARD_DATE_PATTERN =
        /([A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+\s(?:second|minute|hour|day|week|month|year)s? ago|[Yy]esterday|\b\d{4}\b\s(?:—|·))/;

      // ── Pre-flight: confirm AI Overview is actually present ──────────────
      const placeholder =
        document.querySelector('[data-container-id="model-response-placeholder"]') ||
        document.querySelector('div:has(> [data-container-id="main-col"])') ||
        document.querySelector('[data-container-id="main-col"]')?.parentElement;
      if (!placeholder)
        return { success: false, error: "model-response-placeholder not found" };

      const mainCol =
        placeholder.querySelector('[data-container-id="main-col"]') || placeholder;
      const mainColText = (mainCol.textContent || "").trim();
      if (mainColText.length < 50)
        return { success: false, error: "no-ai-overview: main-col empty" };
      // ────────────────────────────────────────────────────────────────────

      const clone = placeholder.cloneNode(true) as HTMLElement;

      // Step 1: Remove noise tags
      for (const tag of ["script", "style", "button", "svg", "noscript", "iframe"]) {
        for (const el of clone.querySelectorAll(tag)) el.remove();
      }
      for (const el of clone.querySelectorAll("sup")) el.remove();

      // Step 1b: Unwrap inline Google entity chip links (e.g. <a href="google.com/search?q=HubSpot">HubSpot</a>)
      // These are not source citations — they're inline links within prose text that turndown
      // would otherwise convert to [text](google-search-url) markdown noise.
      for (const a of clone.querySelectorAll('a[href*="google.com/search"]')) {
        const span = document.createElement("span");
        span.textContent = a.textContent;
        a.parentNode?.replaceChild(span, a);
      }

      // Step 2: Remove source card containers
      for (const sel of [
        '[data-container-id="rhs-col"]',
        '[data-xid="aim-aside-initial-corroboration-container"]',
        '[role="dialog"][data-type="hovc"]',
      ]) {
        for (const el of clone.querySelectorAll(sel)) el.remove();
      }

      // Step 3: Remove remaining source card blocks via ARIA link pattern
      const remainingSourceLinks = Array.from(
        clone.querySelectorAll(
          'a[target="_blank"][rel="noopener"][aria-label*="Opens in"]',
        ),
      );
      const toRemove = new Set<Element>();
      for (const link of remainingSourceLinks) {
        let el: Element = link;
        while (el.parentElement && el.parentElement !== clone) {
          const parent = el.parentElement;
          if (parent.querySelector('[role="heading"]')) break;
          const hasNonSourceSibling = Array.from(parent.children).some(
            (sib) =>
              sib !== el &&
              (sib.textContent || "").length > 100 &&
              !sib.querySelector('a[aria-label*="Opens in"]'),
          );
          if (hasNonSourceSibling) break;
          el = parent;
        }
        toRemove.add(el);
      }
      for (const el of toRemove) el.remove();

      // Step 4: Safety net for leftover source cards — but NEVER touch main-col
      // FIX: grab main-col reference FIRST, then skip it and its descendants
      const extractedMainCol =
        clone.querySelector('[data-container-id="main-col"]') || clone;

      for (const el of clone.querySelectorAll("*")) {
        // ✅ NEW: skip main-col itself and anything inside it
        if (
          extractedMainCol &&
          (el === extractedMainCol || extractedMainCol.contains(el))
        )
          continue;

        const text = el.textContent || "";
        if (
          text.length < 5000 &&
          SOURCE_CARD_DATE_PATTERN.test(text) &&
          !el.querySelector('[role="heading"]')
        ) {
          el.remove();
        }
      }

      // Step 5: Extract main-col prose only; fallback to full cleaned clone
      const html = (extractedMainCol || clone).outerHTML.trim();
      if (!html)
        return { success: false, error: "AI Overview HTML was empty after extraction" };

      return { success: true, html };
    });

    if (!result || !result.success) {
      const message = result?.error || "unknown extraction failure";
      logger.warn(`AI Overview extraction failed: ${message}`);
      throw new Error(message);
    }

    const html = result.html || "";
    logger.debug(`✅ Extracted AI Overview HTML (${html.length} chars)`);
    return html;
  } catch (error: any) {
    logger.error(`AI Overview extraction error: ${error.message}`);
    throw error;
  }
}
