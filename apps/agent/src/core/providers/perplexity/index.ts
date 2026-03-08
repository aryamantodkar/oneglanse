import { extractSourcesFromPerplexity } from "./lib/extractSources.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";

function isPerplexitySearchUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			url.hostname.endsWith("perplexity.ai") &&
			url.pathname.startsWith("/search/") &&
			url.pathname.length > "/search/".length
		);
	} catch {
		return false;
	}
}

async function waitForPerplexitySearchUrl(page: Parameters<ProviderConfig["waitForResponse"]>[0], preSubmitUrl: string): Promise<boolean | undefined> {
	if (isPerplexitySearchUrl(preSubmitUrl)) {
		return undefined;
	}

	const deadline = Date.now() + 4000;
	while (Date.now() < deadline) {
		if (isPerplexitySearchUrl(page.url())) {
			return true;
		}
		await page.waitForTimeout(100);
	}

	return false;
}

export const perplexityConfig: ProviderConfig = {
	url: "https://www.perplexity.ai/",
	warmupDelayMs: 5000,
	label: "Perplexity",
	displayName: "Perplexity",
	requiresWarmup: true,
	checkSubmitSuccess: async (page, { preSubmitUrl }) =>
		waitForPerplexitySearchUrl(page, preSubmitUrl),
	waitForResponse: (page) => waitForAssistantToFinish(page, "perplexity"),
	extractResponse: (page) => extractAssistantMarkdown(page, "perplexity"),
	postNavigationHook: async (page) => {
		// Perplexity loads slowly — single consolidated randomised delay.
		const delay = 3000 + Math.floor(Math.random() * 4000);
		await page.waitForTimeout(delay);
	},
	extractSources: async (page) => {
		const btn = await findSourcesButton(page);
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromPerplexity(page);
	},
};
