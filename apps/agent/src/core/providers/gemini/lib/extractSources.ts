import type { Source } from "@oneglanse/types";
import { SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export async function extractSourcesFromGemini(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = (await page.evaluate((sels) => {
		const results: Array<{
			rawHref: string;
			title: string;
			citedText: string;
			imgSrc: string | null;
		}> = [];

		// Target the sidebar source cards directly
		const cards = document.querySelectorAll(sels.sourceCard);
		if (!cards || cards.length === 0) return results;

		for (const card of Array.from(cards)) {
			const a = card.querySelector(sels.anchor);
			let href = a?.getAttribute("href") || "";
			if (!href) continue;

			// Normalize URL: resolve relative, strip fragment
			try {
				href = new URL(href, window.location.origin).toString();
				href = href.split("#")[0] ?? "";
			} catch {
				continue;
			}

			// Title from .title, fallback to .source-path; Node.js fills in domain/url if empty
			const title =
				card.querySelector(sels.title)?.textContent?.trim() ||
				card.querySelector(sels.titleFallback)?.textContent?.trim() ||
				"";

			// Snippet as cited text
			const citedText =
				card.querySelector(sels.snippet)?.textContent?.trim() || "";

			// Prefer the actual favicon img already in the card
			const imgSrc = card.querySelector(sels.icon)?.getAttribute("src") ?? null;

			results.push({ rawHref: href, title, citedText, imgSrc });
		}

		return results;
	}, SELECTORS.gemini)) as RawSource[];

	if (!(await clickButtonViaDispatch(page, sourcesButton))) return [];
	await page.waitForTimeout(300);

	return buildSources(rawSources);
}
