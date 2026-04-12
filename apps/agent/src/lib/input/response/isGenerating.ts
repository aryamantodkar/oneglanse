import type { Provider } from "@oneglanse/types";
import { PROVIDER_RESPONSE_GENERATION_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";

export async function isGenerating(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	for (const selector of PROVIDER_RESPONSE_GENERATION_SELECTORS[provider] || []) {
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
