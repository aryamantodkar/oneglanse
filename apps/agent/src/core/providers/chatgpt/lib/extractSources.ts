import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export const CHATGPT_RAW_SOURCES_DOM_EXTRACTOR = String.raw`(_helpers) => {
	const results = [];

	const getLeafTexts = (anchor) => {
		const texts = [];

		for (const el of anchor.querySelectorAll("*")) {
			const text = (el.textContent || "").trim();
			if (!text) continue;

			if (
				Array.from(el.children).some(
					(child) => (child.textContent || "").trim().length > 0,
				)
			) {
				continue;
			}

			texts.push(text);
		}

		return Array.from(new Set(texts));
	};

	for (const anchor of Array.from(
		document.querySelectorAll(
			'ul li > a[target="_blank"][rel*="noopener"][href^="http"]',
		),
	)) {
		if (!(anchor instanceof HTMLAnchorElement)) continue;

		const rawHref = anchor.href.replace(/#.*$/, "");
		if (!rawHref) continue;

		const texts = getLeafTexts(anchor);
		if (texts.length === 0) continue;
		const sorted = [...texts].sort((a, b) => a.length - b.length);
		const citedText = sorted[sorted.length - 1] || "";
		const title =
			sorted.length >= 2 ? sorted[sorted.length - 2] || "" : sorted[0] || "";

		results.push({
			rawHref,
			title,
			citedText,
		});
	}

	return results;
}`;

export async function extractSourcesFromChatgpt(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = (await page.runDomOp("raw-sources", {
		provider: "chatgpt",
	})) as RawSource[];

	if (!(await clickButtonViaDispatch(page, sourcesButton))) return [];
	await page.waitForTimeout(300);

	return buildSources(rawSources, { provider: "chatgpt" });
}
