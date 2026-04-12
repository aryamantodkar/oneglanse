import type { Provider } from "@oneglanse/types";
import { PROVIDER_MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";
import { turndown } from "./converter.js";

export async function extractAssistantMarkdown(
	page: Page,
	provider: Provider,
): Promise<string> {
	const html = await page.runDomOp<string>("response-html", {
		provider,
		selectors: PROVIDER_MODEL_RESPONSE_SELECTORS[provider] || [],
	});
	if (!html) return "";

	const markdown = turndown.turndown(html);
	return markdown.replace(/\n{3,}/g, "\n\n").trim();
}
