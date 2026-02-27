import type { Provider } from "@oneglanse/types";
import { MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";
import { extractAnthropicBlocks } from "../markdown/anthropicBlocks.js";

export async function getText(
	page: Page,
	provider: Provider,
	fetchingResponses = false,
): Promise<string> {
	for (const selector of MODEL_RESPONSE_SELECTORS) {
		const nodes = page.locator(selector);
		const count = await nodes.count();
		if (count === 0) continue;

		for (let i = count - 1; i >= 0; i--) {
			const el = nodes.nth(i);

			try {
				if (!(await el.isVisible())) continue;

				let text = "";

				if (provider === "anthropic" && fetchingResponses) {
					text = await extractAnthropicBlocks(el, "text");
				} else {
					text = await el.evaluate((el) => {
						if (!(el instanceof HTMLElement)) return "";
						return el.innerText?.trim() || el.textContent?.trim() || "";
					});
				}

				if (text.length > 0) return text;
			} catch {}
		}
	}

	return "";
}
