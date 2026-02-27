import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { SELECTORS } from "../../../config/selectors.js";
import {
	buildSources,
	clickButtonViaDispatch,
	type RawSource,
} from "../../../lib/extraction/sourceUtils.js";

export async function extractSourcesFromOpenai(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = await page.evaluate((sels) => {
		const results: Array<{
			rawHref: string;
			title: string;
			citedText: string;
			imgSrc: string | null;
		}> = [];

		const flyout =
			// ChatGPT
			[sels.flyout.threadFlyout, sels.flyout.aside]
				.map((s) => document.querySelector(s))
				.find(Boolean) ||
			// Claude / generic dialogs
			Array.from(document.querySelectorAll(sels.flyout.dialog)).find((d) =>
				d.querySelector(sels.anchor),
			) ||
			// Perplexity
			[sels.flyout.testId, sels.flyout.classSources, sels.flyout.classCitation]
				.map((s) => document.querySelector(s))
				.find(Boolean) ||
			// Last-resort fallback (panel already open)
			Array.from(document.querySelectorAll("div")).find(
				(d) =>
					d.querySelectorAll(sels.anchor).length >= 2 &&
					(d as HTMLElement).offsetHeight > 100,
			);

		if (!flyout) return results;

		const headers = Array.from(flyout.querySelectorAll(sels.listItem));

		for (const header of headers) {
			const label = header.textContent?.trim().toLowerCase();
			if (label !== "citations" && label !== "more") continue;

			const ul = header.nextElementSibling;
			if (!(ul instanceof HTMLUListElement)) continue;

			const anchors = ul.querySelectorAll<HTMLAnchorElement>(sels.anchor);

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
				const imgSrc =
					a.querySelector(sels.img)?.getAttribute("src") ?? null;

				results.push({ rawHref: href, title, citedText, imgSrc });
			}
		}

		return results;
	}, SELECTORS.openai) as RawSource[];

	if (!(await clickButtonViaDispatch(page, sourcesButton))) return [];
	await page.waitForTimeout(300);

	// Preserve original dedup key: same URL+title can appear with different citedText
	return buildSources(
		rawSources,
		(url, title, citedText) => `${url}|${title}|${citedText}`,
	);
}
