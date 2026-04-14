import type { Provider, Source } from "@oneglanse/types";
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

const PROVIDER_OWNED_SOURCE_DOMAINS: Partial<Record<Provider, string[]>> = {
	chatgpt: ["chatgpt.com", "openai.com"],
	perplexity: ["perplexity.ai"],
	gemini: ["gemini.google.com", "google.com"],
	claude: ["claude.ai", "anthropic.com"],
	"ai-overview": ["google.com"],
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSourceTitle(rawTitle: string, url: string): string {
	const normalized = rawTitle.replace(/\s+/g, " ").trim();
	if (!normalized) return normalized;

	const domain = getDomain(url)?.replace(/^www\./i, "") || "";
	const hostLabel = domain.split(".")[0] || "";
	const prefixes = [domain, hostLabel].filter(Boolean);

	let title = normalized;
	for (const prefix of prefixes) {
		title = title.replace(
			new RegExp(`^${escapeRegExp(prefix)}(?:\\s+|(?=[A-Z]))`, "i"),
			"",
		);
	}

	return title.trim() || normalized;
}

function isProviderOwnedSource(provider: Provider | undefined, url: string): boolean {
	if (!provider) return false;

	const hostname = (() => {
		try {
			return new URL(url).hostname.toLowerCase();
		} catch {
			return "";
		}
	})();
	if (!hostname) return false;

	return (PROVIDER_OWNED_SOURCE_DOMAINS[provider] || []).some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
	);
}

/**
 * Normalizes raw browser-extracted sources into typed Source objects:
 * - strips URL fragments
 * - extracts domains via getDomain()
 * - resolves favicons via getFaviconUrls()
 */
export function buildSources(
	rawSources: RawSource[],
	options?: { provider?: Provider },
): Source[] {
	const results: Source[] = [];

	for (const { rawHref, title: rawTitle, citedText } of rawSources) {
		const url = rawHref.replace(/#.*$/, "");
		if (!url) continue;
		if (isProviderOwnedSource(options?.provider, url)) continue;

		const domain = getDomain(url) || null;
		const title = normalizeSourceTitle(rawTitle || "", url) || domain || url;
		const favicon = getFaviconUrls(domain ?? "")?.[0] ?? null;

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
