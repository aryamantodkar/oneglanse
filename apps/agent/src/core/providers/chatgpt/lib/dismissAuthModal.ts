import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import {
	canUseOsLevelInput,
	clickLocatorLikeUser,
} from "../../../../lib/browser/humanBehavior.js";

const AUTH_DIALOG_SELECTOR = '[role="dialog"][data-state="open"]';
const AUTH_DIALOG_TEXT_RE = /Thanks for trying ChatGPT|Log in or sign up/i;
const DISMISS_MODAL_TEXT_RE = /^Stay logged out$/i;
const MODAL_POLL_INTERVAL_MS = 200;

type DismissChatgptAuthModalOptions = {
	waitForAppearanceMs?: number;
};

export async function dismissChatgptAuthModal(
	page: Page,
	options: DismissChatgptAuthModalOptions = {},
): Promise<void> {
	const waitForAppearanceMs = options.waitForAppearanceMs ?? 0;
	const deadline = Date.now() + waitForAppearanceMs;

	do {
		const dialog = page
			.locator(AUTH_DIALOG_SELECTOR)
			.filter({ hasText: AUTH_DIALOG_TEXT_RE })
			.first();
		const dialogVisible = await dialog.isVisible().catch(() => false);

		if (!dialogVisible) {
			if (Date.now() >= deadline) return;
			await page.waitForTimeout(MODAL_POLL_INTERVAL_MS);
			continue;
		}

		const dismissTarget = dialog.getByText(DISMISS_MODAL_TEXT_RE).first();
		const dismissVisible = await dismissTarget.isVisible().catch(() => false);
		if (!dismissVisible) return;

		logger.log("[chatgpt] dismissing auth modal via Stay logged out");

		const clicked = await clickLocatorLikeUser(page, dismissTarget, {
			timeout: 5000,
		}).catch(() => false);
		if (!clicked && canUseOsLevelInput(page)) {
			return;
		}
		await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
		await page.waitForTimeout(300);
		return;
	} while (Date.now() <= deadline);
}
