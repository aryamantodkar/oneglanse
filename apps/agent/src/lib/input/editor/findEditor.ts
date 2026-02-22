import { EDITOR_SELECTORS } from "@onescope/utils";
import type { Locator, Page } from "playwright";
import { logger } from "../../utils/logger.js";

export async function findActiveEditor(page: Page): Promise<Locator> {
	for (const selector of EDITOR_SELECTORS) {
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

	throw new Error("❌ No active prompt editor found");
}
