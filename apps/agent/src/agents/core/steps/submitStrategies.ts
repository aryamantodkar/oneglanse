import type { Provider } from "@onescope/types";
import type { Locator, Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";

export type SubmitContext = {
	page: Page;
	provider: Provider;
	input: Locator;
	sendButton: Locator | null;
	preSubmitContent: string;
	preSubmitUrl: string;
};

export async function checkSubmissionSuccess(
	ctx: SubmitContext,
): Promise<boolean> {
	const { page, input, preSubmitContent, preSubmitUrl } = ctx;
	await page.waitForTimeout(800);

	// Check 1: Input cleared (most reliable signal)
	const currentContent = await input
		.evaluate((el) => {
			if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
				return el.value.trim();
			return (el.textContent || "").trim();
		})
		.catch(() => preSubmitContent);

	if (currentContent !== preSubmitContent && currentContent.length === 0) {
		return true;
	}

	// Check 2: URL changed (navigation-based submission)
	if (page.url() !== preSubmitUrl) {
		return true;
	}

	// Check 3: Input field is gone (some providers remove it after submit)
	const inputGone = await input.isVisible().catch(() => false);
	if (!inputGone) {
		return true;
	}

	return false;
}

export async function tryEnterSubmit(ctx: SubmitContext): Promise<boolean> {
	const { page, input } = ctx;
	try {
		await input.focus();
		await page.keyboard.press("Enter");
		const success = await checkSubmissionSuccess(ctx);
		if (success) {
			logger.debug("  ✅ Submitted via Enter key");
			return true;
		}
	} catch (err: any) {
		logger.debug(`  ℹ️ Enter submit failed: ${err?.message}`);
	}
	return false;
}

export async function tryForceClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	try {
		await sendButton.click({ force: true });
		const success = await checkSubmissionSuccess(ctx);
		if (success) {
			logger.debug("  ✅ Submitted via force click");
			return true;
		}
	} catch (err: any) {
		logger.debug(`  ℹ️ Force click failed: ${err?.message}`);
	}
	return false;
}

export async function tryDispatchClick(ctx: SubmitContext): Promise<boolean> {
	const { page, sendButton } = ctx;
	if (!sendButton) return false;
	try {
		const handle = await sendButton.elementHandle();
		if (handle) {
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
			const success = await checkSubmissionSuccess(ctx);
			if (success) {
				logger.debug("  ✅ Submitted via dispatched click");
				return true;
			}
		}
	} catch (err: any) {
		logger.debug(`  ℹ️ Dispatch click failed: ${err?.message}`);
	}
	return false;
}
