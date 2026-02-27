import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { EDITOR_SELECTORS, PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import { logger } from "../../utils/logger.js";

export async function findActiveEditor(
	page: Page,
	provider?: Provider,
): Promise<Locator> {
	const selectors = provider
		? PROVIDER_EDITOR_SELECTORS[provider] || EDITOR_SELECTORS
		: EDITOR_SELECTORS;

	for (const selector of selectors) {
		const nodes = page.locator(selector);

		const count = await nodes.count();
		for (let i = 0; i < count; i++) {
			const el = nodes.nth(i);

			try {
				if (await el.isVisible()) {
					await el.focus().catch(() => {});

					logger.log(`  ✓ Found input: ${selector}`);
					return el;
				}
			} catch {
				logger.log(`  ⚠️  Found but hidden: ${selector}`);
			}
		}
	}

	throw new NotFoundError("active prompt editor");
}
