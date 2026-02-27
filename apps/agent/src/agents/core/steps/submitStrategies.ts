import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { toErrorMessage } from "@oneglanse/errors";
import { env } from "../../../env.js";
import { logger } from "../../../lib/utils/logger.js";
import { withTimeout } from "../../../lib/utils/withTimeout.js";

const SUBMIT_METHOD_TIMEOUT_MS = env.SUBMIT_METHOD_TIMEOUT_MS;

export type SubmitContext = {
	page: Page;
	provider: Provider;
	input: Locator;
	sendButton: Locator | null;
	preSubmitContent: string;
	preSubmitUrl: string;
};

async function checkSubmissionSuccess(
	ctx: SubmitContext,
): Promise<boolean> {
	const { page, input, provider, preSubmitContent, preSubmitUrl } = ctx;
	await page.waitForTimeout(800);

	// Google Search submits by navigation; treat ?q= URL mutation as success.
	if (provider === "google-ai-overview") {
		const currentUrl = page.url();
		if (currentUrl !== preSubmitUrl) {
			try {
				const parsed = new URL(currentUrl);
				if (parsed.searchParams.get("q")?.trim()) return true;
			} catch {
				return true;
			}
		}
	}

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
		const success = await withTimeout("Enter submit", async () => {
			await input.focus();
			await page.keyboard.press("Enter");
			return await checkSubmissionSuccess(ctx);
		}, SUBMIT_METHOD_TIMEOUT_MS);
		if (success) {
			logger.debug("  ✅ Submitted via Enter key");
			return true;
		}
	} catch (err) {
		logger.debug(`  ℹ️ Enter submit failed: ${toErrorMessage(err)}`);
	}
	return false;
}

export async function tryForceClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	try {
		const success = await withTimeout("Force-click submit", async () => {
			await sendButton.click({ force: true, timeout: SUBMIT_METHOD_TIMEOUT_MS });
			return await checkSubmissionSuccess(ctx);
		}, SUBMIT_METHOD_TIMEOUT_MS);
		if (success) {
			logger.debug("  ✅ Submitted via force click");
			return true;
		}
	} catch (err) {
		logger.debug(`  ℹ️ Force click failed: ${toErrorMessage(err)}`);
	}
	return false;
}

export async function tryDispatchClick(ctx: SubmitContext): Promise<boolean> {
	const { page, sendButton } = ctx;
	if (!sendButton) return false;
	try {
		const handle = await withTimeout(
			"Dispatch-click submit",
			async () => await sendButton.elementHandle(),
			SUBMIT_METHOD_TIMEOUT_MS,
		);
		if (handle) {
			const success = await withTimeout("Dispatch-click submit", async () => {
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
				return await checkSubmissionSuccess(ctx);
			}, SUBMIT_METHOD_TIMEOUT_MS);
			if (success) {
				logger.debug("  ✅ Submitted via dispatched click");
				return true;
			}
		}
	} catch (err) {
		logger.debug(`  ℹ️ Dispatch click failed: ${toErrorMessage(err)}`);
	}
	return false;
}
