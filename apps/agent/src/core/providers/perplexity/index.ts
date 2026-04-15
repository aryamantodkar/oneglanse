import { extractSourcesFromPerplexity } from "./lib/extractSources.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";
import {
	PERPLEXITY_URL,
	perplexityPostNavigationHook,
	resetPerplexityPage,
	waitForPerplexitySearchUrl,
} from "./lib/navigation.js";

export const perplexityConfig: ProviderConfig = {
	url: PERPLEXITY_URL,
	label: "Perplexity",
	displayName: "Perplexity",
	beforeRetryHook: resetPerplexityPage,
	betweenPromptsHook: resetPerplexityPage,
	checkSubmitSuccess: async (page, { preSubmitUrl }) =>
		waitForPerplexitySearchUrl(page, preSubmitUrl),
	waitForResponse: (page) => waitForAssistantToFinish(page, "perplexity"),
	extractResponse: (page) => extractAssistantMarkdown(page, "perplexity"),
	postNavigationHook: perplexityPostNavigationHook,
	extractSources: async (page) => {
		const btn = await findSourcesButton(page);
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromPerplexity(page, btn);
	},
};
