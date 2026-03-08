import type { Provider } from "@oneglanse/types";
import { PROVIDER_MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";

export async function getText(
	page: Page,
	provider: Provider,
): Promise<string> {
	for (const selector of PROVIDER_MODEL_RESPONSE_SELECTORS[provider] || []) {
		const nodes = page.locator(selector);
		const count = await nodes.count();
		if (count === 0) continue;

		for (let i = count - 1; i >= 0; i--) {
			const el = nodes.nth(i);

			try {
				if (!(await el.isVisible())) continue;

				let text = "";

				text = await el.evaluate(
					(el, currentProvider) => {
						if (!(el instanceof HTMLElement)) return "";

						if (currentProvider === "gemini") {
							const inner =
								el.querySelector("message-content") ||
								el.querySelector(".model-response-text") ||
								el;

							if (!(inner instanceof HTMLElement)) return "";
							return inner.innerText?.trim() || inner.textContent?.trim() || "";
						}

						return el.innerText?.trim() || el.textContent?.trim() || "";
					},
					provider,
				);

				if (text.length > 0) return text;
			} catch {}
		}
	}

	return "";
}
