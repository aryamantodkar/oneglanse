import type { Provider } from "@oneglanse/types";
import { PROVIDER_MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

async function findLastAssistantLocator(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	for (const selector of PROVIDER_MODEL_RESPONSE_SELECTORS[provider] || []) {
		const locator = page.locator(selector);
		if ((await locator.count()) === 0) continue;
		return locator.last();
	}
	return null;
}

export async function findLastAssistantBox(
	page: Page,
	provider: Provider,
): Promise<{ x: number; y: number; width: number; height: number; } | null> {
	const locator = await findLastAssistantLocator(page, provider);
	return locator ? await locator.boundingBox() : null;
}
