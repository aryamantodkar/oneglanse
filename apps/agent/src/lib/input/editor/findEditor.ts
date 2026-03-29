import { NotFoundError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";

export async function findActiveEditorFromSelectors(
	page: Page,
	selectors: string[],
): Promise<Locator> {
	for (const selector of selectors) {
		const nodes = page.locator(selector);

		const count = await nodes.count();
		for (let i = 0; i < count; i++) {
			const el = nodes.nth(i);

			try {
				const visible = await el.isVisible().catch(() => false);
				if (!visible) {
					continue;
				}

				const state = await el.getEditableState().catch(() => null);
				if (!(state?.connected && state.visible && state.editable)) {
					continue;
				}

				const box = await el.boundingBox().catch(() => null);
				if (!box || box.width < 8 || box.height < 8) {
					continue;
				}

				await el.focus().catch(() => {});
				logger.debug(`found editor: ${selector}`);
				return el;
			} catch (_error) {
				logger.debug(`found but hidden: ${selector}`);
			}
		}
	}

	throw new NotFoundError("active prompt editor");
}

export async function findActiveEditor(
	page: Page,
	provider?: Provider,
): Promise<Locator> {
	const fallbackSelectors = [
		...new Set(Object.values(PROVIDER_EDITOR_SELECTORS).flat()),
	];
	const selectors = provider
		? PROVIDER_EDITOR_SELECTORS[provider] || fallbackSelectors
		: fallbackSelectors;

	return findActiveEditorFromSelectors(page, selectors);
}
