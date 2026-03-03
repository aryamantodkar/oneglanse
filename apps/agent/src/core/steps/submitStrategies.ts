import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { toErrorMessage } from "@oneglanse/errors";
import { env } from "../../env.js";
import { logger, withTimeout } from "@oneglanse/utils";
import { PROVIDER_CONFIGS } from "../providers/index.js";

const SUBMIT_METHOD_TIMEOUT_MS = env.SUBMIT_METHOD_TIMEOUT_MS;

export type SubmitContext = {
	page: Page;
	provider: Provider;
	input: Locator;
	sendButton: Locator | null;
	preSubmitContent: string;
	preSubmitUrl: string;
};

type SubmitAttempt = {
	errorLabel: string;
	successMessage: string;
	run: () => Promise<boolean>;
};

async function checkSubmissionSuccess(
	ctx: SubmitContext,
): Promise<boolean> {
	const { page, input, provider, preSubmitContent, preSubmitUrl } = ctx;
	await page.waitForTimeout(800);

	// Ask provider config for a custom success signal first.
	// undefined = no opinion, fall through to generic checks below.
	const config = PROVIDER_CONFIGS[provider];
	const customResult = await config.checkSubmitSuccess?.(page, preSubmitUrl);
	if (customResult !== undefined) return customResult;

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

async function attemptSubmit(
	attempt: SubmitAttempt,
): Promise<boolean> {
	try {
		const success = await attempt.run();

		if (success) {
			logger.debug(`  ✅ ${attempt.successMessage}`);
			return true;
		}
	} catch (err) {
		logger.debug(
			`  ℹ️ ${attempt.errorLabel} failed: ${toErrorMessage(err)}`,
		);
	}

	return false;
}

export async function tryEnterSubmit(ctx: SubmitContext): Promise<boolean> {
	const { page, input } = ctx;
	return attemptSubmit({
		errorLabel: "Enter submit",
		successMessage: "Submitted via Enter key",
		run: async () =>
			await withTimeout("Enter submit", async () => {
				await input.focus();
				await page.keyboard.press("Enter");
				return await checkSubmissionSuccess(ctx);
			}, SUBMIT_METHOD_TIMEOUT_MS),
	});
}

export async function tryForceClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit({
		errorLabel: "Force click",
		successMessage: "Submitted via force click",
		run: async () =>
			await withTimeout("Force-click submit", async () => {
				await sendButton.click({ force: true, timeout: SUBMIT_METHOD_TIMEOUT_MS });
				return await checkSubmissionSuccess(ctx);
			}, SUBMIT_METHOD_TIMEOUT_MS),
	});
}

export async function tryDispatchClick(ctx: SubmitContext): Promise<boolean> {
	const { page, sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit({
		errorLabel: "Dispatch click",
		successMessage: "Submitted via dispatched click",
		run: async () => {
			const handle = await withTimeout(
				"Dispatch-click submit",
				async () => await sendButton.elementHandle(),
				SUBMIT_METHOD_TIMEOUT_MS,
			);
			if (!handle) return false;

			return await withTimeout("Dispatch-click submit", async () => {
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
		},
	});
}
