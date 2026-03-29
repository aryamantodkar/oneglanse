import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, withTimeout } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import { env } from "../../env.js";
import {
	clickLocatorLikeUser,
	pressKeyLikeUser,
} from "../../lib/browser/humanBehavior.js";
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

async function humanPause(
	page: Page,
	minMs: number,
	maxMs: number,
): Promise<void> {
	await page.waitForTimeout(randomBetween(minMs, maxMs));
}

async function humanizeFocus(page: Page, input: Locator): Promise<void> {
	const box = await input.boundingBox().catch(() => null);
	if (box) {
		const x = box.x + box.width * (0.35 + Math.random() * 0.3);
		const y = box.y + box.height * (0.35 + Math.random() * 0.3);
		await page.mouse.move(x, y, { steps: randomBetween(8, 20) });
		await humanPause(page, 40, 120);
		await clickLocatorLikeUser(page, input, {
			delay: randomBetween(40, 120),
			timeout: 3000,
		}).catch(() => null);
	} else {
		await clickLocatorLikeUser(page, input, {
			force: true,
			timeout: 3000,
		}).catch(() => null);
	}

	await humanPause(page, 80, 180);
	await input.focus().catch(() => null);
	await humanPause(page, 50, 140);
}

function hasWords(content: string): boolean {
	return content.trim().split(/\s+/).filter(Boolean).length > 0;
}

async function readInputContent(input: Locator): Promise<string> {
	return input.readInputValue();
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

async function checkSubmissionSuccess(ctx: SubmitContext): Promise<boolean> {
	const { page, input, provider, preSubmitContent, preSubmitUrl } = ctx;
	// 500ms gives the page time to react before we sample state.
	// 300ms was too short — some providers briefly hide the input during a
	// React state transition, causing Check 3 to fire as a false positive.
	await page.waitForTimeout(500);

	// Ask provider config for a custom success signal first.
	// undefined = no opinion, fall through to generic checks below.
	const config = PROVIDER_CONFIGS[provider];
	const customResult = await config.checkSubmitSuccess?.(page, {
		preSubmitUrl,
	});
	if (customResult !== undefined) return customResult;

	// Check 1: Input cleared (most reliable signal)
	const currentContent = await input.readInputValue().catch(() => preSubmitContent);
	if (currentContent !== preSubmitContent && currentContent.length === 0) {
		return true;
	}

	// Check 2: URL changed (navigation-based submission)
	if ((await page.getUrl().catch(() => page.url())) !== preSubmitUrl) {
		return true;
	}

	// Check 3: Input field is gone — double-check to rule out transient DOM hides.
	// isVisible() returns false if the element is hidden/removed. On error, assume
	// visible (conservative) so we don't falsely report success on a page crash.
	const inputVisible = await input.isVisible().catch(() => true);
	if (!inputVisible) {
		await page.waitForTimeout(200);
		const stillGone = !(await input.isVisible().catch(() => true));
		return stillGone;
	}

	return false;
}

async function attemptSubmit(
	ctx: SubmitContext,
	attempt: SubmitAttempt,
): Promise<boolean> {
	try {
		// beforeSubmitHook is called once in askPrompt.ts before the submit loop.
		// Do NOT call it again here — it was causing double modal sweeps per attempt.
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
		logger.debug(`  ℹ️ ${attempt.errorLabel} failed: ${message}`);
	}

	return false;
}

export async function tryEnterSubmit(ctx: SubmitContext): Promise<boolean> {
	const { page, input } = ctx;
	return attemptSubmit(ctx, {
		errorLabel: "Enter submit",
		successMessage: "Submitted via Enter key",
		run: async () => {
			await ensureInputHasWords(ctx, "Enter submit");
			return await withTimeout(
				"Enter submit",
				async () => {
					await humanizeFocus(page, input);

					await humanPause(page, 120, 260);

					// Press Enter directly on the input locator rather than via page.keyboard
					// so the key event is guaranteed to land on the input element itself,
					// bypassing any autocomplete dropdown focus drift (critical for AI Overview).
					await input
						.press("Enter", { delay: randomBetween(40, 120) })
						.catch(() => null);
					return await checkSubmissionSuccess(ctx);
				},
				SUBMIT_METHOD_TIMEOUT_MS,
			);
		},
	});
}

export async function tryNativeClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit(ctx, {
		errorLabel: "Native click",
		successMessage: "Submitted via native click",
		run: async () => {
			await ensureInputHasWords(ctx, "Native click");
			return await withTimeout(
				"Native-click submit",
				async () => {
					await humanPause(ctx.page, 80, 180);
					await sendButton.scrollIntoViewIfNeeded().catch(() => null);
					await humanPause(ctx.page, 50, 150);
					await clickLocatorLikeUser(ctx.page, sendButton, {
						timeout: SUBMIT_METHOD_TIMEOUT_MS,
						delay: randomBetween(35, 120),
					}).catch(() => null);
					return await checkSubmissionSuccess(ctx);
				},
				SUBMIT_METHOD_TIMEOUT_MS,
			);
		},
	});
}

export async function tryForceClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit(ctx, {
		errorLabel: "Force click",
		successMessage: "Submitted via force click",
		run: async () => {
			await ensureInputHasWords(ctx, "Force click");
			return await withTimeout(
				"Force-click submit",
				async () => {
					await humanPause(ctx.page, 80, 180);
					await sendButton.scrollIntoViewIfNeeded().catch(() => null);
					await humanPause(ctx.page, 50, 150);
					await clickLocatorLikeUser(ctx.page, sendButton, {
						force: true,
						timeout: SUBMIT_METHOD_TIMEOUT_MS,
						delay: randomBetween(35, 120),
					});
					return await checkSubmissionSuccess(ctx);
				},
				SUBMIT_METHOD_TIMEOUT_MS,
			);
		},
	});
}

export async function tryDispatchClick(ctx: SubmitContext): Promise<boolean> {
	const { sendButton } = ctx;
	if (!sendButton) return false;
	return attemptSubmit(ctx, {
		errorLabel: "Dispatch click",
		successMessage: "Submitted via dispatched click",
		run: async () => {
			await ensureInputHasWords(ctx, "Dispatch click");
			return await withTimeout(
				"Dispatch-click submit",
				async () => {
					await sendButton.dispatchClick();
					return await checkSubmissionSuccess(ctx);
				},
				SUBMIT_METHOD_TIMEOUT_MS,
			);
		},
	});
}
