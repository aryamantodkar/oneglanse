import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import {
	buildSources,
	clickButtonViaDispatch,
	type RawSource,
} from "../../../lib/extraction/sourceUtils.js";

export async function extractSourcesFromOpenai(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = await page.evaluate(() => {
		const results: Array<{
			rawHref: string;
			title: string;
			citedText: string;
			imgSrc: string | null;
		}> = [];

		const flyout =
			// ChatGPT
			document.querySelector('div[class*="threadFlyOut"]') ||
			document.querySelector("aside") ||
			// Claude / generic dialogs
			Array.from(document.querySelectorAll('[role="dialog"]')).find((d) =>
				d.querySelector('a[href^="http"]'),
			) ||
			// Perplexity
			document.querySelector('[data-testid*="sources"]') ||
			document.querySelector('[class*="sources"]') ||
			document.querySelector('[class*="citation"]') ||
			// Last-resort fallback (panel already open)
			Array.from(document.querySelectorAll("div")).find(
				(d) =>
					d.querySelectorAll('a[href^="http"]').length >= 2 &&
					d.offsetHeight > 100,
			);

		if (!flyout) return results;

		const headers = Array.from(flyout.querySelectorAll("li"));

		for (const header of headers) {
			const label = header.textContent?.trim().toLowerCase();
			if (label !== "citations" && label !== "more") continue;

			const ul = header.nextElementSibling;
			if (!(ul instanceof HTMLUListElement)) continue;

			const anchors = ul.querySelectorAll<HTMLAnchorElement>("a[href^='http']");

			for (const a of Array.from(anchors)) {
				let href = a.getAttribute("href");
				if (!href) continue;

				try {
					href = new URL(href, location.origin).toString();
					href = href.replace(/#.*$/, "") ?? "";
				} catch {
					continue;
				}

				const blocks = Array.from(a.children).filter(
					(el) => el instanceof HTMLElement,
				) as HTMLElement[];

				const title = blocks[1]?.textContent?.trim() || "";
				const citedText = blocks[2]?.textContent?.trim() || "";
				const imgSrc = a.querySelector("img")?.getAttribute("src") ?? null;

				results.push({ rawHref: href, title, citedText, imgSrc });
			}
		}

		return results;
	}) as RawSource[];

	if (!(await clickButtonViaDispatch(page, sourcesButton))) return [];
	await page.waitForTimeout(300);

	// Preserve original dedup key: same URL+title can appear with different citedText
	return buildSources(
		rawSources,
		(url, title, citedText) => `${url}|${title}|${citedText}`,
	);
}
