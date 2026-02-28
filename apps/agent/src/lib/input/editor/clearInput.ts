import type { Locator, Page } from "playwright";

type ClearInputOptions = {
	clickTimeoutMs?: number;
	dismissWithEscape?: boolean;
	waitAfterMs?: number;
};

export async function clearEditorInput(
	page: Page,
	input: Locator,
	options: ClearInputOptions = {},
): Promise<boolean> {
	const { clickTimeoutMs = 3000, dismissWithEscape = false, waitAfterMs = 0 } = options;

	const count = await input.count().catch(() => 0);
	if (count === 0) return false;

	try {
		await input.click({ force: true, timeout: clickTimeoutMs });

		const modKey = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modKey}+A`).catch(() => null);
		await page.keyboard.press("Backspace").catch(() => null);

		await input.evaluate((el) => {
			if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
				el.value = "";
				el.dispatchEvent(new Event("input", { bubbles: true }));
				el.dispatchEvent(new Event("change", { bubbles: true }));
				return;
			}
			if (el instanceof HTMLElement) {
				el.innerText = "";
				el.dispatchEvent(new Event("input", { bubbles: true }));
			}
		});

		if (dismissWithEscape) {
			await page.keyboard.press("Escape").catch(() => null);
		}

		if (waitAfterMs > 0) {
			await page.waitForTimeout(waitAfterMs);
		}

		return true;
	} catch {
		return false;
	}
}