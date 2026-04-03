import { dismissChatgptAuthModal } from "./lib/dismissAuthModal.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";

const CHATGPT_URL = "https://chatgpt.com/";

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
};
