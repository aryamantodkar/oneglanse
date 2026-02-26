import type { Source } from "@onescope/types";
import type { Locator, Page } from "playwright";

export async function extractSourcesFromGemini(page: Page, sourcesButton: Locator): Promise<Source[]> {
	const sources = await page.evaluate(() => {
	  const results: Source[] = [];
	  const seen = new Set<string>();
	  // Target the sidebar source cards directly
	  const cards = document.querySelectorAll("inline-source-card");
	  if (!cards || cards.length === 0) {
		return results;
	  }
	  for (const card of Array.from(cards)) {
		const a = card.querySelector("a");
		let href = a?.getAttribute("href") || "";
		if (!href) continue;
		// Normalize URL
		try {
		  href = new URL(href, window.location.origin).toString();
		  href = href.split("#")[0] ?? "";
		} catch {
		  continue;
		}
		// Extract domain
		let domain: string | null = null;
		try {
		  domain = new URL(href).hostname.replace(/^www\\./, "");
		} catch {
		  domain = null;
		}
		// Title from .title, fallback to .source-path
		const title =
		  card.querySelector(".title")?.textContent?.trim() ||
		  card.querySelector(".source-path")?.textContent?.trim() ||
		  domain ||
		  href;
		// Snippet as cited text
		const citedText =
		  card.querySelector(".snippet")?.textContent?.trim() || "";
		// Favicon: use the actual img already in the card
		const imgEl = card.querySelector("img.icon-image, img");
		const favicon =
		  imgEl?.getAttribute("src") ||
		  (domain
			? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
			: null);
		const key = `${href}|${title}`;
		if (seen.has(key)) continue;
		seen.add(key);
		results.push({ title, cited_text: citedText, url: href, domain, favicon });
	  }
	  return results;
	});

	const handle = await sourcesButton.elementHandle();
	if (!handle) return [];

	await page.evaluate((el) => {
		if (el instanceof HTMLElement) {
			el.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					composed: true,
					view: window,
				}),
			);
		}
	}, handle);

	await page.waitForTimeout(300);

	return Array.isArray(sources) ? sources : [];
  }