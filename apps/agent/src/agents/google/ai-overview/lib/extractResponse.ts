import type { Page } from "playwright";
import { logger } from "../../../../lib/utils/logger.js";

export async function extractAIOverviewResponse(page: Page): Promise<string> {
	try {
		const result = await page.evaluate(() => {
			// Matches ALL Google source card date formats:
			// "May 27, 2025 —"  |  "27 Apr 2017 —"  |  "3 days ago"  |  "Yesterday"  |  "2025 —"
			const SOURCE_CARD_DATE_PATTERN =
				/([A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2} [A-Z][a-z]+ \d{4}|\d+\s(?:second|minute|hour|day|week|month|year)s? ago|[Yy]esterday|\b\d{4}\b\s(?:—|·))/;

			const placeholder = document.querySelector(
				'[data-container-id="model-response-placeholder"]',
			);
			if (!placeholder)
				return {
					success: false,
					error: "model-response-placeholder not found",
				};

			const clone = placeholder.cloneNode(true) as HTMLElement;

			// Step 1: Remove noise tags
			for (const tag of [
				"script",
				"style",
				"button",
				"svg",
				"noscript",
				"iframe",
			]) {
				for (const el of clone.querySelectorAll(tag)) el.remove();
			}
			for (const el of clone.querySelectorAll("sup")) el.remove();

			// Step 2: Remove source card containers using STABLE SEMANTIC selectors only
			// (no obfuscated class names that break on every Google deploy)
			for (const sel of [
				// Semantic container IDs — "rhs-col" is Google's own stable name for the source panel
				'[data-container-id="rhs-col"]',
				// Semantic xid — stable identifier for the corroboration aside panel
				'[data-xid="aim-aside-initial-corroboration-container"]',
				// Hover corroboration dialog — identified by role + data-type, both semantic
				'[role="dialog"][data-type="hovc"]',
			]) {
				for (const el of clone.querySelectorAll(sel)) el.remove();
			}

			// Step 3: Remove any REMAINING source card blocks not caught by the above
			// Source card links always have: target="_blank" + rel="noopener" + aria-label="...Opens in new tab."
			// This is a stable ARIA pattern set by Google for accessibility — won't change with UI rebuilds.
			// Walk up from each such link to find its source card container and remove it.
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
					// Stop walking up if this parent contains a heading (means it's mixed with prose)
					if (parent.querySelector('[role="heading"]')) break;
					// Stop if parent has a non-source sibling with substantial text (prose sibling)
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

			// Step 4: Safety net — remove any remaining element whose text matches a date snippet pattern
			// AND doesn't contain a heading (so we never accidentally remove prose sections)
			for (const el of clone.querySelectorAll("*")) {
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
			const mainCol = clone.querySelector('[data-container-id="main-col"]');
			const html = (mainCol || clone).outerHTML.trim();
			if (!html)
				return {
					success: false,
					error: "AI Overview HTML was empty after extraction",
				};

			return { success: true, html };
		});

		if (!result || !result.success) {
			logger.warn(`AI Overview extraction failed: ${result?.error}`);
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
