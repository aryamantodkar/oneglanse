import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { extractResolvedResponseHtml } from "../../selectors/intelligence.js";
import { turndown } from "./converter.js";

export async function extractAssistantMarkdown(
	page: Page,
	provider: Provider,
): Promise<string> {
	const html = await extractResolvedResponseHtml(page, provider);
	if (!html) return "";

	const markdown = turndown.turndown(html);
	return markdown.replace(/\n{3,}/g, "\n\n").trim();
}
