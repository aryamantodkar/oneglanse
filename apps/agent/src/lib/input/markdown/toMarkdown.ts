import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { extractResponseHtml } from "../response/responseMonitor.js";
import { extractResolvedResponseHtml } from "../../selectors/index.js";
import { turndown } from "./converter.js";

export async function extractAssistantMarkdown(
	page: Page,
	provider: Provider,
): Promise<string> {
	// Prefer a validated selector-backed response container. This keeps extraction
	// anchored to the latest answer and lets the selector cache self-heal via the
	// model when the UI changes. The response monitor remains a fallback.
	const selectorHtml = await extractResolvedResponseHtml(page, provider, {
		allowModel: true,
	});
	if (selectorHtml) {
		return turndown.turndown(selectorHtml).replace(/\n{3,}/g, "\n\n").trim();
	}

	const monitorHtml = await extractResponseHtml(page);
	if (!monitorHtml) return "";
	return turndown.turndown(monitorHtml).replace(/\n{3,}/g, "\n\n").trim();
}
