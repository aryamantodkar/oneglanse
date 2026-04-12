import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";

export async function findSourcesButton(
	page: Page,
	provider?: Provider,
): Promise<Locator | null> {
	if (!provider) return null;

	const lastMatchIndex = await page.runDomOp<number>("sources-button-index", {
		provider,
	});

	return lastMatchIndex >= 0 ? page.locator("button").nth(lastMatchIndex) : null;
}
