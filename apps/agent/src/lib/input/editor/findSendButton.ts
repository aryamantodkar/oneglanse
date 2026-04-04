import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { findResolvedSendButton } from "../../selectors/index.js";

export async function findEnabledSendButton(
	page: Page,
	provider: Provider,
): Promise<Locator | null> {
	return await findResolvedSendButton(page, provider);
}
