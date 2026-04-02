import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { getResolvedResponseText } from "../../selectors/intelligence.js";

export async function getText(
	page: Page,
	provider: Provider,
): Promise<string> {
	return await getResolvedResponseText(page, provider);
}
