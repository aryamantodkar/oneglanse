import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

export async function findActiveEditor(
	page: Page,
	provider?: Provider,
): Promise<Locator> {
	const fallbackSelectors = [...new Set(Object.values(PROVIDER_EDITOR_SELECTORS).flat())];
	const selectors = provider
		? PROVIDER_EDITOR_SELECTORS[provider] || fallbackSelectors
		: fallbackSelectors;

	for (const selector of selectors) {
		const nodes = page.locator(selector);

		const count = await nodes.count();
		for (let i = 0; i < count; i++) {
			const el = nodes.nth(i);

			try {
				if (await el.isVisible()) {
					await el.focus().catch(() => {});

					logger.debug(`found editor: ${selector}`);
					return el;
				}
			} catch {
				logger.debug(`found but hidden: ${selector}`);
			}
		}
	}

	throw new NotFoundError("active prompt editor");
}
