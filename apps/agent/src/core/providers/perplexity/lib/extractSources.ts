import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import {
	canUseOsLevelInput,
	pressKeyLikeUser,
} from "../../../../lib/browser/humanBehavior.js";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export const PERPLEXITY_RAW_SOURCES_DOM_EXTRACTOR = String.raw`(_helpers) => {
	const results = [];
	const panel = document.querySelector(
		'[role="tabpanel"][aria-labelledby*="citations"]',
	);
	if (!panel) return results;

	const getCleanTexts = (anchor) => {
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

	for (const anchor of Array.from(panel.querySelectorAll('a[href^="http"]'))) {
		if (!(anchor instanceof HTMLAnchorElement)) continue;

		const rawHref = anchor.href.replace(/#.*$/, "");
		if (!rawHref) continue;

		const texts = getCleanTexts(anchor);
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

export async function extractSourcesFromPerplexity(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = (await page.runDomOp("raw-sources", {
		provider: "perplexity",
	})) as RawSource[];

	const clickedToClose = await clickButtonViaDispatch(page, sourcesButton).catch(
		() => false,
	);
	if (!clickedToClose) {
		const escaped = await pressKeyLikeUser(page, "Escape").catch(() => false);
		if (!escaped && canUseOsLevelInput(page)) {
			return buildSources(rawSources, { provider: "perplexity" });
		}
	}

	await page.waitForTimeout(300);
	const escaped = await pressKeyLikeUser(page, "Escape").catch(() => false);
	if (!escaped && canUseOsLevelInput(page)) {
		return buildSources(rawSources, { provider: "perplexity" });
	}
	await page.waitForTimeout(300);

	return buildSources(rawSources, { provider: "perplexity" });
}
