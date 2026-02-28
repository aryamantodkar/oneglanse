import type { Page } from "playwright";
import { BaseError, ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import { SELECTORS, logger } from "@oneglanse/utils";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
  try {
    const result = await page.evaluate((sels) => {
      const SOURCE_CARD_DATE_PATTERN =
        /([A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+\s(?:second|minute|hour|day|week|month|year)s? ago|[Yy]esterday|\b\d{4}\b\s(?:—|·))/;

      // ── Pre-flight: confirm AI Overview is actually present ──────────────
      const placeholder =
        document.querySelector(sels.placeholder) ||
        document.querySelector(sels.placeholderWrapper) ||
        document.querySelector(sels.mainCol)?.parentElement;
      if (!placeholder)
        return { success: false, error: "model-response-placeholder not found" };

      const mainCol =
        placeholder.querySelector(sels.mainCol) || placeholder;
      const mainColText = (mainCol.textContent || "").trim();
      if (mainColText.length < 50)
        return { success: false, error: "no-ai-overview: main-col empty" };
      // ────────────────────────────────────────────────────────────────────

      const clone = placeholder.cloneNode(true) as HTMLElement;

      // Step 1: Remove noise tags (merged into single pass)
      for (const tag of sels.noiseTags) {
        for (const el of clone.querySelectorAll(tag)) el.remove();
      }

      // Step 1b: Unwrap inline Google entity chip links (e.g. <a href="google.com/search?q=HubSpot">HubSpot</a>)
      // These are not source citations — they're inline links within prose text that turndown
      // would otherwise convert to [text](google-search-url) markdown noise.
      for (const a of clone.querySelectorAll(sels.googleChip)) {
        const span = document.createElement("span");
        span.textContent = a.textContent;
        a.parentNode?.replaceChild(span, a);
      }

      // Step 2: Remove source card containers
      for (const sel of sels.sourceContainers) {
        for (const el of clone.querySelectorAll(sel)) el.remove();
      }

      // Step 3: Remove remaining source card blocks via ARIA link pattern
      const remainingSourceLinks = Array.from(
        clone.querySelectorAll(sels.sourceLink),
      );
      const toRemove = new Set<Element>();
      for (const link of remainingSourceLinks) {
        let el: Element = link;
        while (el.parentElement && el.parentElement !== clone) {
          const parent = el.parentElement;
          if (parent.querySelector(sels.heading)) break;
          const hasNonSourceSibling = Array.from(parent.children).some(
            (sib) =>
              sib !== el &&
              (sib.textContent || "").length > 100 &&
              !sib.querySelector(sels.inlineSourceLink),
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
        clone.querySelector(sels.mainCol) || clone;

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
          !el.querySelector(sels.heading)
        ) {
          el.remove();
        }
      }

      // Step 5: Extract main-col prose only; fallback to full cleaned clone
      const html = (extractedMainCol || clone).outerHTML.trim();
      if (!html)
        return { success: false, error: "AI Overview HTML was empty after extraction" };

      return { success: true, html };
    }, SELECTORS.googleAiOverviewResponse);

    if (!result || !result.success) {
      const message = result?.error || "unknown extraction failure";
      logger.warn(`AI Overview extraction failed: ${message}`);
      throw new ExternalServiceError("google-ai-overview", message);
    }

    const html = result.html || "";
    logger.debug(`✅ Extracted AI Overview HTML (${html.length} chars)`);
    return html;
  } catch (error) {
    const msg = toErrorMessage(error);
    logger.error(`AI Overview extraction error: ${msg}`);
    if (error instanceof BaseError) throw error;
    throw new ExternalServiceError("google-ai-overview", msg, 500, undefined, error);
  }
}
