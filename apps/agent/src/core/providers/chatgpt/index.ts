import { extractSourcesFromChatgpt } from "./lib/extractSources.js";
import { dismissChatgptAuthModal } from "./lib/dismissAuthModal.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";
import { CHATGPT_URL, resetChatgptPage } from "./lib/pageLifecycle.js";

export const chatgptConfig: ProviderConfig = {
	url: CHATGPT_URL,
	label: "ChatGPT",
	displayName: "ChatGPT",
	waitForResponse: (page) => waitForAssistantToFinish(page, "chatgpt"),
	extractResponse: (page) => extractAssistantMarkdown(page, "chatgpt"),
	beforePromptHook: (page) =>
		dismissChatgptAuthModal(page, { waitForAppearanceMs: 500 }),
	afterTypingHook: (page) =>
		dismissChatgptAuthModal(page, { waitForAppearanceMs: 1500 }),
	beforeSubmitHook: (page) =>
		dismissChatgptAuthModal(page, { waitForAppearanceMs: 1500 }),
	afterSubmitHook: (page) =>
		dismissChatgptAuthModal(page, { waitForAppearanceMs: 1500 }),
	beforeRetryHook: resetChatgptPage,
	extractSources: async (page) => {
		const btn = await findSourcesButton(page);
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromChatgpt(page, btn);
	},
};
