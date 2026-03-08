import { extractSourcesFromGemini } from "./lib/extractSources.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { openSourcesPanel } from "../../../lib/input/sources/openPanel.js";
import { findSourcesButton } from "../../../lib/input/sources/findButton.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { resetProviderPage } from "../_shared/resetProviderPage.js";
import type { ProviderConfig } from "../types.js";

function isGeminiAppUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		return (
			url.hostname === "gemini.google.com" &&
			url.pathname.startsWith("/app/") &&
			url.pathname.length > "/app/".length
		);
	} catch {
		return false;
	}
}

async function waitForGeminiAppUrl(page: Parameters<ProviderConfig["waitForResponse"]>[0], preSubmitUrl: string): Promise<boolean | undefined> {
	if (isGeminiAppUrl(preSubmitUrl)) {
		return undefined;
	}

	const deadline = Date.now() + 4000;
	while (Date.now() < deadline) {
		if (isGeminiAppUrl(page.url())) {
			return true;
		}
		await page.waitForTimeout(100);
	}

	return false;
}

export const geminiConfig: ProviderConfig = {
	url: "https://gemini.google.com/",
	warmupDelayMs: 5000,
	label: "Gemini",
	displayName: "Gemini",
	requiresWarmup: true,
	checkSubmitSuccess: async (page, { preSubmitUrl }) =>
		waitForGeminiAppUrl(page, preSubmitUrl),
	waitForResponse: (page) => waitForAssistantToFinish(page, "gemini"),
	extractResponse: (page) => extractAssistantMarkdown(page, "gemini"),
	betweenPromptsHook: async (page) =>
		resetProviderPage(page, "gemini", "https://gemini.google.com/"),
	extractSources: async (page) => {
		const btn = await findSourcesButton(page, "gemini");
		if (!btn) return [];
		await openSourcesPanel(page, btn);
		return extractSourcesFromGemini(page, btn);
	},
};
