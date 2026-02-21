import type { Provider } from "@onescope/types";
import { MODEL_RESPONSE_SELECTORS } from "@onescope/utils";
import type { Page } from "playwright";
import { extractAIOverviewResponse } from "../../agents/google/ai-overview/lib/extractResponse.js";
import { extractAnthropicBlocks } from "./extractAnthropicBlocks.js";
import { turndown } from "./markdownConverter.js";

export async function extractAssistantMarkdown(
	page: Page,
	provider: Provider,
): Promise<string> {
	if (provider === "google-ai-overview") {
		const html = await extractAIOverviewResponse(page);
		if (!html || html.length === 0) return "";
		const markdown = turndown.turndown(html);
		return markdown.replace(/\n{3,}/g, "\n\n").trim();
	}

	for (const selector of MODEL_RESPONSE_SELECTORS) {
		const nodes = page.locator(selector);
		const count = await nodes.count();
		if (count === 0) continue;

		for (let i = count - 1; i >= 0; i--) {
			const el = nodes.nth(i);

			try {
				if (!(await el.isVisible())) continue;

				const html =
					provider === "anthropic"
						? await extractAnthropicBlocks(el, "html")
						: await el.evaluate((root) => {
								if (!(root instanceof HTMLElement)) return "";
								return root.innerHTML?.trim() || "";
							});

				if (html.length > 0) {
					// Convert and normalize multiple newlines to double newlines
					const markdown = turndown.turndown(html);
					return markdown.replace(/\n{3,}/g, "\n\n").trim();
				}
			} catch {}
		}
	}

	return "";
}
