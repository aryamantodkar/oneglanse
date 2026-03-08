import type { Page } from "playwright";

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

		await page.keyboard.press("Escape").catch(() => null);
		await page.waitForTimeout(200);
		return;
	} while (Date.now() <= deadline);
}
