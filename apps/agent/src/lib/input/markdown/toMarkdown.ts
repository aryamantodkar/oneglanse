import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { extractResponseHtml } from "../response/responseMonitor.js";
import { extractResolvedResponseHtml } from "../../selectors/index.js";
import { turndown } from "./converter.js";

export async function extractAssistantMarkdown(
	page: Page,
	provider: Provider,
): Promise<string> {
	// Primary: use the responseMonitor's best candidate (works for all streaming providers)
	const monitorHtml = await extractResponseHtml(page);
	if (monitorHtml) {
		return turndown.turndown(monitorHtml).replace(/\n{3,}/g, "\n\n").trim();
	}

	// Fallback: selector-based for providers that don't use the responseMonitor (e.g. AI Overview)
	const selectorHtml = await extractResolvedResponseHtml(page, provider);
	if (!selectorHtml) return "";
	return turndown.turndown(selectorHtml).replace(/\n{3,}/g, "\n\n").trim();
}
