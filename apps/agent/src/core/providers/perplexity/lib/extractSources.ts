import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { pressKeyLikeUser } from "../../../../lib/browser/humanBehavior.js";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export const PERPLEXITY_RAW_SOURCES_DOM_EXTRACTOR = String.raw`(_helpers) => {
	const results = [];
	// Perplexity used to render citations inside a labelled tabpanel. It no
	// longer does: opening the sources panel injects the links elsewhere in the
	// document, leaving that tabpanel present but empty. Prefer the panel when
	// it actually holds links, otherwise scan the document and drop
	// Perplexity's own URLs.
	const panel = document.querySelector(
		'[role="tabpanel"][aria-labelledby*="citations"]',
	);
	const panelHasLinks =
		!!panel && panel.querySelectorAll('a[href^="http"]').length > 0;
	const scope = panelHasLinks ? panel : document;
	const isSelfLink = (href) => {
		try {
			return /(^|\.)perplexity\.ai$/.test(new URL(href).hostname);
		} catch (err) {
			return true;
		}
	};

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

	const seenHrefs = new Set();
	for (const anchor of Array.from(scope.querySelectorAll('a[href^="http"]'))) {
		if (!(anchor instanceof HTMLAnchorElement)) continue;

		const rawHref = anchor.href.replace(/#.*$/, "");
		if (!rawHref) continue;
		if (!panelHasLinks && isSelfLink(rawHref)) continue;
		if (seenHrefs.has(rawHref)) continue;
		seenHrefs.add(rawHref);

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

	const clickedToClose = await clickButtonViaDispatch(
		page,
		sourcesButton,
	).catch(() => false);
	if (!clickedToClose) {
		await pressKeyLikeUser(page, "Escape").catch(() => false);
	}

	await page.waitForTimeout(300);
	await pressKeyLikeUser(page, "Escape").catch(() => false);
	await page.waitForTimeout(300);

	return buildSources(rawSources, { provider: "perplexity" });
}
