import { MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

export async function findLastAssistantLocator(
	page: Page,
): Promise<Locator | null> {
	for (const selector of MODEL_RESPONSE_SELECTORS) {
		const locator = page.locator(selector);
		if ((await locator.count()) === 0) continue;
		return locator.last();
	}
	return null;
}

export async function findLastAssistantBox(page: Page): Promise<{ x: number; y: number; width: number; height: number; } | null> {
	const locator = await findLastAssistantLocator(page);
	return locator ? await locator.boundingBox() : null;
}
