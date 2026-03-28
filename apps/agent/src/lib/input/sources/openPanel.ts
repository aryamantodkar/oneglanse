import type { Locator, Page } from "playwright";
import { clickButtonViaDispatch } from "../../extraction/sourceUtils.js";

/**
 * Clicks the sources button to open the panel, then waits for it to animate in.
 * Used by providers whose sources live behind a UI toggle (Gemini, ChatGPT, Perplexity).
 */
export async function openSourcesPanel(page: Page, btn: Locator): Promise<void> {
	// Try a real Playwright click first — isTrusted=true, less detectable.
	// Fall back to synthetic dispatch only if the button is blocked by an overlay.
	const clicked = await btn
		.scrollIntoViewIfNeeded()
		.then(() => btn.click({ timeout: 3000 }))
		.then(() => true)
		.catch(() => false);

	if (!clicked) {
		if (!(await clickButtonViaDispatch(page, btn))) return;
	}
	await page.waitForTimeout(1000);
}
