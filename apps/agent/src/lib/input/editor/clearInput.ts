import type { Locator, Page } from "playwright";
import {
	clickLocatorLikeUser,
	getBrowserPrimaryModifier,
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
			const clicked = await clickLocatorLikeUser(page, input, {
				force: true,
				timeout: clickTimeoutMs,
			}).catch(() => false);
		if (!clicked) {
			return false;
		}

			const primaryModifier = await getBrowserPrimaryModifier(page);
			const selectAllShortcuts =
				primaryModifier === "Control"
					? ["Control+A"]
					: [`${primaryModifier}+A`, "Control+A"];

			let clearedByKeyboard = false;
			for (const shortcut of selectAllShortcuts) {
				// Target input directly so keys land on the element regardless of focus state
				await input.press(shortcut).catch(() => null);
				await input.press("Backspace").catch(() => null);
				clearedByKeyboard = await input
					.readInputValue()
					.then((value) => value.trim().length === 0)
					.catch(() => false);
				if (clearedByKeyboard) break;
			}

			if (!clearedByKeyboard) {
				await input.setInputValue("");
			}

		if (dismissWithEscape) {
			await input.press("Escape").catch(() => null);
		}

		if (waitAfterMs > 0) {
			await page.waitForTimeout(waitAfterMs);
		}

		return true;
	} catch {
		return false;
	}
}
