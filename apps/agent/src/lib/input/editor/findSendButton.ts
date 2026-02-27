import { SUBMIT_BTN_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

export async function findEnabledSendButton(
	page: Page,
): Promise<Locator | null> {
	for (const selector of SUBMIT_BTN_SELECTORS) {
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
