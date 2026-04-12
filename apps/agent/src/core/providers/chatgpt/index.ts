import { extractSourcesFromChatgpt } from "./lib/extractSources.js";
import { dismissChatgptAuthModal } from "./lib/dismissAuthModal.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { resetProviderPage } from "../_shared/resetProviderPage.js";
import type { ProviderConfig } from "../types.js";

const CHATGPT_URL = "https://chatgpt.com/";

async function resetChatgptPage(
	page: Parameters<ProviderConfig["waitForResponse"]>[0],
): Promise<void> {
	await resetProviderPage(page, "chatgpt", CHATGPT_URL);
	await dismissChatgptAuthModal(page, { waitForAppearanceMs: 1000 });
}

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
		const btn = await findSourcesButton(page, "chatgpt");
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromChatgpt(page, btn);
	},
};
