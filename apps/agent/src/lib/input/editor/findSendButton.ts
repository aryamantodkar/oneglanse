import type { Provider } from "@oneglanse/types";
import { PROVIDER_SUBMIT_BTN_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

export async function findEnabledSendButton(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	for (const selector of PROVIDER_SUBMIT_BTN_SELECTORS[provider] || []) {
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
	return null;
}
