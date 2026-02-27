import type { Provider } from "@oneglanse/types";
import { MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";
import { extractAnthropicBlocks } from "./anthropicBlocks.js";
import { turndown } from "./converter.js";

export async function extractAssistantMarkdown(
	page: Page,
	provider: Provider,
): Promise<string> {
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
