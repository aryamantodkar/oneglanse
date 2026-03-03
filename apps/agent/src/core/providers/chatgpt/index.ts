import { extractSourcesFromChatgpt } from "./lib/extractSources.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";

export const chatgptConfig: ProviderConfig = {
	url: "https://chatgpt.com/",
	warmupDelayMs: 5000,
	label: "ChatGPT",
	displayName: "ChatGPT",
	requiresWarmup: true,
	waitForResponse: (page) => waitForAssistantToFinish(page, "chatgpt"),
	extractResponse: (page) => extractAssistantMarkdown(page, "chatgpt"),
	extractSources: async (page) => {
		const btn = await findSourcesButton(page);
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromChatgpt(page, btn);
	},
};
