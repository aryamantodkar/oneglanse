import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import { env } from "../../env.js";
import { logger, withTimeout } from "@oneglanse/utils";
import { PROVIDER_CONFIGS } from "../providers/index.js";

const SUBMIT_METHOD_TIMEOUT_MS = env.SUBMIT_METHOD_TIMEOUT_MS;
const EMPTY_INPUT_SUBMIT_ERROR = "Input has no content before submit";

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

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

async function humanPause(page: Page, minMs: number, maxMs: number): Promise<void> {
	await page.waitForTimeout(randomBetween(minMs, maxMs));
}

async function humanizeFocus(
	page: Page,
	input: Locator,
): Promise<void> {
	const box = await input.boundingBox().catch(() => null);
	if (box) {
		const x = box.x + box.width * (0.35 + Math.random() * 0.3);
		const y = box.y + box.height * (0.35 + Math.random() * 0.3);
		await page.mouse.move(x, y, { steps: randomBetween(8, 20) });
		await humanPause(page, 40, 120);
		await page.mouse.click(x, y, {
			delay: randomBetween(40, 120),
		});
	} else {
		await input.click({ force: true, timeout: 3000 }).catch(() => null);
	}

	await humanPause(page, 80, 180);
	await input.focus().catch(() => null);
	await humanPause(page, 50, 140);
}

function hasWords(content: string): boolean {
	return content
		.trim()
		.split(/\s+/)
		.filter(Boolean).length > 0;
}

async function readInputContent(input: Locator): Promise<string> {
	return input.evaluate((el) => {
		if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
			return el.value.trim();
		}
		return (el.textContent || "").trim();
	});
}

async function ensureInputHasWords(
	ctx: SubmitContext,
	attemptLabel: string,
): Promise<boolean> {
	const liveContent = await readInputContent(ctx.input).catch(
		() => ctx.preSubmitContent,
	);
	const content = liveContent.length > 0 ? liveContent : ctx.preSubmitContent;

	if (hasWords(content)) return true;

	throw new ExternalServiceError(
		ctx.provider,
		`${EMPTY_INPUT_SUBMIT_ERROR} (${attemptLabel})`,
	);
}

async function checkSubmissionSuccess(
	ctx: SubmitContext,
): Promise<boolean> {
	const { page, input, provider, preSubmitContent, preSubmitUrl } = ctx;
	await page.waitForTimeout(300);

	// Ask provider config for a custom success signal first.
	// undefined = no opinion, fall through to generic checks below.
	const config = PROVIDER_CONFIGS[provider];
	const customResult = await config.checkSubmitSuccess?.(page);
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
		const message = toErrorMessage(err);
		// Missing input content should fail fast and let retry policy handle recovery.
		if (message.includes(EMPTY_INPUT_SUBMIT_ERROR)) {
			throw err;
		}
		logger.debug(
			`  ℹ️ ${attempt.errorLabel} failed: ${message}`,
		);
	}

	return false;
}

export async function tryEnterSubmit(ctx: SubmitContext): Promise<boolean> {
	const { page, input } = ctx;
	return attemptSubmit({
		errorLabel: "Enter submit",
		successMessage: "Submitted via Enter key",
		run: async () => {
			await ensureInputHasWords(ctx, "Enter submit");
			return await withTimeout("Enter submit", async () => {
				await humanizeFocus(page, input);

				await humanPause(page, 120, 260);

				await page.keyboard.press("Enter", {
					delay: randomBetween(40, 120),
				});
				return await checkSubmissionSuccess(ctx);
			}, SUBMIT_METHOD_TIMEOUT_MS);
		},
	});
}

export async function tryForceClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit({
		errorLabel: "Force click",
		successMessage: "Submitted via force click",
		run: async () => {
			await ensureInputHasWords(ctx, "Force click");
			return await withTimeout("Force-click submit", async () => {
				await humanPause(ctx.page, 80, 180);
				await sendButton.hover().catch(() => null);
				await humanPause(ctx.page, 50, 150);
				await sendButton.click({
					force: true,
					timeout: SUBMIT_METHOD_TIMEOUT_MS,
					delay: randomBetween(35, 120),
				});
				return await checkSubmissionSuccess(ctx);
			}, SUBMIT_METHOD_TIMEOUT_MS);
		},
	});
}

export async function tryDispatchClick(ctx: SubmitContext): Promise<boolean> {
	const { page, sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit({
		errorLabel: "Dispatch click",
		successMessage: "Submitted via dispatched click",
		run: async () => {
			await ensureInputHasWords(ctx, "Dispatch click");
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
