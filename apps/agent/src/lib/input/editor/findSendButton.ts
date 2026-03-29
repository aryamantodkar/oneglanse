import type { Provider } from "@oneglanse/types";
import { PROVIDER_SUBMIT_BTN_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

export async function findEnabledSendButton(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	const selectors = PROVIDER_SUBMIT_BTN_SELECTORS[provider] || [];

	// First pass: visible + enabled (preferred — native click will work)
	for (const selector of selectors) {
		const buttons = page.locator(selector);
		const count = await buttons.count();
		for (let i = 0; i < count; i++) {
			const btn = buttons.nth(i);
			try {
				if ((await btn.isVisible()) && (await btn.isEnabled())) {
					return btn;
				}
			} catch {}
		}
	}

	// Second pass: enabled-only, ignoring visibility.
	// Restricted to ai-overview where Google's input[name="btnK"] is opacity:0
	// until hover. Applying this to other providers risks returning a wrong
	// hidden button (e.g. a shadow-DOM button[type="submit"] on Gemini).
	if (provider === "ai-overview") {
		for (const selector of selectors) {
			const buttons = page.locator(selector);
			const count = await buttons.count();
			for (let i = 0; i < count; i++) {
				const btn = buttons.nth(i);
				try {
					if (await btn.isEnabled()) {
						return btn;
					}
				} catch {}
			}
		}
	}

	return null;
}
