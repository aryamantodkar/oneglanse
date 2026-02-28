import type { Locator, Page } from "playwright";

/**
 * Clicks the sources button to open the panel, then waits for it to animate in.
 * Used by providers whose sources live behind a UI toggle (Gemini, ChatGPT, Perplexity).
 */
export async function openSourcesPanel(page: Page, btn: Locator): Promise<void> {
	const handle = await btn.elementHandle();
	if (!handle) return;
	await page.evaluate((el) => {
		if (el instanceof HTMLElement) {
			el.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					composed: true,
					view: window,
				}),
			);
		}
	}, handle);
	await page.waitForTimeout(1000);
}
