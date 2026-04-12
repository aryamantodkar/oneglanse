import type { Source } from "@oneglanse/types";
import { getDomain, getFaviconUrls } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

/**
 * Shape returned by the browser bridge before Node.js post-processing.
 * URL should already be resolved to absolute by the browser (via new URL(href, location.origin)),
 * but fragment stripping and domain extraction happen here in Node.js.
 */
export type RawSource = {
	rawHref: string;
	title: string;
	citedText: string;
};

/**
 * Normalizes raw browser-extracted sources into typed Source objects:
 * - strips URL fragments
 * - extracts domains via getDomain()
 * - resolves favicons via getFaviconUrls()
 * - deduplicates using the provided key function
 *
 * @param keyFn Controls dedup granularity. Defaults to url|title.
 *              Pass `(url, title, citedText) => \`${url}|${title}|${citedText}\`` for tightest dedup.
 */
export function buildSources(
	rawSources: RawSource[],
	keyFn: (url: string, title: string, citedText: string) => string = (
		url,
		title,
	) => `${url}|${title}`,
): Source[] {
	const seen = new Set<string>();
	const results: Source[] = [];

	for (const { rawHref, title: rawTitle, citedText } of rawSources) {
		const url = rawHref.replace(/#.*$/, "");
		if (!url) continue;

		const domain = getDomain(url) || null;
		const title = rawTitle || domain || url;
		const favicon = getFaviconUrls(domain ?? "")?.[0] ?? null;

		const key = keyFn(url, title, citedText);
		if (seen.has(key)) continue;
		seen.add(key);

		results.push({ title, cited_text: citedText, url, domain, favicon });
	}

	return results;
}

/**
 * Dispatches a synthetic MouseEvent click on a Playwright Locator element.
 * Used by providers that need a JS-level click instead of Playwright's .click()
 * (e.g. to close a sources flyout after reading it).
 *
 * Returns true if the click was dispatched, false if the element handle was unavailable.
 */
export async function clickButtonViaDispatch(
	_page: Page,
	button: Locator,
): Promise<boolean> {
	await button.dispatchClick();
	return true;
}
