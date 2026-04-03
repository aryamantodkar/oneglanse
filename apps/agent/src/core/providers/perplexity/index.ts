import { dismissPerplexityModal } from "./lib/dismissModal.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";

const PERPLEXITY_URL = "https://www.perplexity.ai/";

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
		if (isPerplexitySearchUrl(await page.getUrl().catch(() => page.url()))) {
			return true;
		}
		await page.waitForTimeout(100);
	}

	return false;
}

async function perplexityPostNavigationHook(
	page: Parameters<NonNullable<ProviderConfig["postNavigationHook"]>>[0],
): Promise<void> {
	const delay = 1000 + Math.floor(Math.random() * 1000);
	await page.waitForTimeout(delay);
}

export const perplexityConfig: ProviderConfig = {
	url: PERPLEXITY_URL,
	label: "Perplexity",
	displayName: "Perplexity",
	beforePromptHook: (page) =>
		dismissPerplexityModal(page, { waitForAppearanceMs: 200 }),
	afterTypingHook: (page) =>
		dismissPerplexityModal(page, { waitForAppearanceMs: 200 }),
	beforeSubmitHook: (page) =>
		dismissPerplexityModal(page, { waitForAppearanceMs: 200 }),
	afterSubmitHook: (page) =>
		dismissPerplexityModal(page, { waitForAppearanceMs: 200 }),
	checkSubmitSuccess: async (page, { preSubmitUrl }) =>
		waitForPerplexitySearchUrl(page, preSubmitUrl),
	waitForResponse: (page) => waitForAssistantToFinish(page, "perplexity"),
	extractResponse: (page) => extractAssistantMarkdown(page, "perplexity"),
	postNavigationHook: perplexityPostNavigationHook,
};
