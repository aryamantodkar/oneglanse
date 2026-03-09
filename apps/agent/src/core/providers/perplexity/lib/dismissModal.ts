import type { Page } from "playwright";
import {
	canUseOsLevelInput,
	pressKeyLikeUser,
} from "../../../../lib/browser/humanBehavior.js";

const PERPLEXITY_DIALOG_SELECTOR = '[role="dialog"], [aria-modal="true"]';
const MODAL_POLL_INTERVAL_MS = 200;

type DismissPerplexityModalOptions = {
	waitForAppearanceMs?: number;
};

export async function dismissPerplexityModal(
	page: Page,
	options: DismissPerplexityModalOptions = {},
): Promise<void> {
	const waitForAppearanceMs = options.waitForAppearanceMs ?? 0;
	const deadline = Date.now() + waitForAppearanceMs;

	do {
		const dialog = page.locator(PERPLEXITY_DIALOG_SELECTOR).first();
		const dialogVisible = await dialog.isVisible().catch(() => false);

		if (!dialogVisible) {
			if (Date.now() >= deadline) return;
			await page.waitForTimeout(MODAL_POLL_INTERVAL_MS);
			continue;
		}

		const escaped = await pressKeyLikeUser(page, "Escape").catch(() => false);
		if (!escaped && canUseOsLevelInput(page)) {
			return;
		}
		await page.waitForTimeout(200);
		return;
	} while (Date.now() <= deadline);
}
