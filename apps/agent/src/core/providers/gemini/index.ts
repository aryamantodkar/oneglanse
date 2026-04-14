import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";
import { extractSourcesFromGemini } from "./lib/extractSources.js";
import {
	handleGeminiConsentPage,
	waitForGeminiConversationUrl,
} from "./lib/session.js";

export const geminiConfig: ProviderConfig = {
	url: "https://gemini.google.com/",
	label: "Gemini",
	displayName: "Gemini",
// Detect consent pages before attempting to locate the editor.
	// consent.google.com has no Gemini composer, so without this check
	// waitForEditorReady times out and misclassifies it as "no_editor".
	postNavigationHook: async (page) => {
		await handleGeminiConsentPage(page);
	},
	beforePromptHook: async (page) => {
		await handleGeminiConsentPage(page);
	},
	checkSubmitSuccess: async (page, { preSubmitUrl }) =>
		waitForGeminiConversationUrl(page, preSubmitUrl),
	waitForResponse: (page) => waitForAssistantToFinish(page, "gemini"),
	extractResponse: (page) => extractAssistantMarkdown(page, "gemini"),
	// No reset between prompts — session is reused in the same conversation.
	// Navigating back to gemini.google.com on each prompt adds unnecessary
	// round-trips and increases detection surface.
	extractSources: async (page) => {
		const btn = await findSourcesButton(page);
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromGemini(page, btn);
	},
};
