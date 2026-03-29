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

	// Second pass: enabled-only, ignoring visibility (handles CSS-hidden submit
	// inputs like Google's input[name="btnK"] which may be opacity:0 until hover).
	// dispatchClick/forceClick still work on these elements.
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

	return null;
}
