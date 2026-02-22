import { RESPONSE_GENERATION_SELECTORS } from "@onescope/utils";
import type { Page } from "playwright";

export async function isGenerating(page: Page): Promise<boolean> {
	for (const selector of RESPONSE_GENERATION_SELECTORS) {
		if (
			await page
				.locator(selector)
				.isVisible()
				.catch(() => false)
		) {
			return true;
		}
	}
	return false;
}
