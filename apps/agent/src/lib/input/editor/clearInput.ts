import type { Locator, Page } from "playwright";
import {
	canUseOsLevelInput,
	clickLocatorLikeUser,
	pressKeyLikeUser,
} from "../../browser/humanBehavior.js";

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
	const {
		clickTimeoutMs = 3000,
		dismissWithEscape = false,
		waitAfterMs = 0,
	} = options;

	const count = await input.count().catch(() => 0);
	if (count === 0) return false;

	try {
		const useOsInput = canUseOsLevelInput(page);
		const clicked = await clickLocatorLikeUser(page, input, {
			force: true,
			timeout: clickTimeoutMs,
		}).catch(() => false);
		if (!clicked && useOsInput) {
			return false;
		}

		const modKey = process.platform === "darwin" ? "Meta" : "Control";
		if (useOsInput) {
			await pressKeyLikeUser(
				page,
				modKey === "Meta" ? "Meta+A" : "Control+A",
			).catch(() => null);
			await pressKeyLikeUser(page, "Backspace").catch(() => null);
		} else {
			await pressKeyLikeUser(page, `${modKey}+A`).catch(() => null);
			await pressKeyLikeUser(page, "Backspace").catch(() => null);
		}
		const clearedByKeyboard = await input
			.readInputValue()
			.then((value) => value.trim().length === 0)
			.catch(() => false);

		if (!clearedByKeyboard && !useOsInput) {
			await input.setInputValue("");
		}

		if (dismissWithEscape) {
			await pressKeyLikeUser(page, "Escape").catch(() => null);
		}

		if (waitAfterMs > 0) {
			await page.waitForTimeout(waitAfterMs);
		}

		return true;
	} catch {
		return false;
	}
}
