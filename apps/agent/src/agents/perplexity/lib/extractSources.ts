import type { Source } from "@oneglanse/types";
import type { Page } from "playwright";
import { buildSources, type RawSource } from "../../../lib/extraction/sourceUtils.js";

export async function extractSourcesFromPerplexity(
	page: Page,
): Promise<Source[]> {
	const rawSources = await page.evaluate(() => {
		const results: Array<{
			rawHref: string;
			title: string;
			citedText: string;
			imgSrc: string | null;
		}> = [];

		// Perplexity sources panel = fixed right-side container with many links
		const flyout = Array.from(
			document.querySelectorAll<HTMLDivElement>("div"),
		).find((d) => {
			const style = getComputedStyle(d);
			return (
				style.position === "fixed" &&
				style.right === "0px" &&
				d.querySelectorAll('a[href^="http"]').length >= 5
			);
		});

		if (!flyout) return results;

		// Each source is a full clickable card (<a>) with a favicon
		const anchors = Array.from(
			flyout.querySelectorAll<HTMLAnchorElement>('a[href^="http"]'),
		).filter(
			(a) =>
				a.querySelector("img") && // favicon present
				a.offsetHeight > 40, // real card, not icon/link
		);

		for (const a of anchors) {
			const href = a.href.replace(/#.*$/, "");
			if (!href) continue;

			// Used locally to filter domain label out of description candidates
			const domainForFilter = (() => {
				try {
					return new URL(href).hostname.replace(/^www\./, "");
				} catch {
					return "";
				}
			})();

			// Title: first visible, non-trivial span
			const title =
				Array.from(a.querySelectorAll("span"))
					.map((s) => s.textContent?.trim() || "")
					.find((t) => t.length > 20 && t.length < 200) || "";

			// Description: longest readable text block, excluding domain label and title
			const citedText =
				Array.from(a.querySelectorAll("div"))
					.map((d) => d.textContent?.trim() || "")
					.filter(
						(t) =>
							t.length > 40 &&
							!t.includes(domainForFilter) &&
							t !== title,
					)
					.at(-1) || "";

			const imgSrc = a.querySelector("img")?.getAttribute("src") ?? null;

			results.push({ rawHref: href, title, citedText, imgSrc });
		}

		return results;
	}) as RawSource[];

	await page.keyboard.press("Escape").catch(() => {});
	await page.waitForTimeout(300);

	return buildSources(rawSources);
}
