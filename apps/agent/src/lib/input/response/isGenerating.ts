import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { isResolvedResponseGenerating } from "../../selectors/intelligence.js";

export async function isGenerating(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	return await isResolvedResponseGenerating(page, provider);
}
