import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { getSelectorProfile } from "../../selectors/index.js";

export async function findLastAssistantLocator(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	const profile = await getSelectorProfile(page, provider, "response", {
		allowModel: false,
	}).catch(() => null);
	for (const selector of profile?.selectors.response ?? []) {
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
