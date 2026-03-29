import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { env } from "../../env.js";
import {
	moveMouseToElement,
	pastePrompt,
	preInteractionIdle,
	smallScroll,
} from "../../lib/browser/humanBehavior.js";
import { findEnabledSendButton } from "../../lib/input/editor/findSendButton.js";
import { waitForEditorReady } from "../../lib/input/editor/waitForReady.js";
import { detectBotPage } from "../../lib/input/response/detectBotPage.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";
import {
	type SubmitContext,
	tryDispatchClick,
	tryEnterSubmit,
	tryForceClick,
	tryNativeClick,
} from "./submitStrategies.js";

const NETWORKIDLE_TIMEOUT_MS = 3000;

const SUBMISSION_PHASE_TIMEOUT_MS = env.SUBMISSION_PHASE_TIMEOUT_MS;

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

export async function askPrompt(
	page: Page,
	prompt: string,
	provider: Provider,
): Promise<void> {
	const config = PROVIDER_CONFIGS[provider];
	await config.beforePromptHook?.(page);

	const input = await waitForEditorReady(page, provider);

	await preInteractionIdle(page);
	if (Math.random() < 0.4) await smallScroll(page);
	if (Math.random() < 0.6) await moveMouseToElement(page, input);

	logger.debug(`pasting ${prompt.length} chars…`);
	await pastePrompt(page, prompt);
	logger.debug("paste complete");

	await page.waitForTimeout(randomBetween(300, 700));
	await config.afterTypingHook?.(page);

	// Store pre-submit state for success detection
	const preSubmitContent = await input.readInputValue();
	const preSubmitUrl = page.url();

	// Verify the editor received the full prompt before attempting submission.
	// Compare lengths rather than exact text — some providers normalise whitespace
	// or handle newlines differently, but a major length shortfall means typing failed.
	if (!preSubmitContent || preSubmitContent.trim().length === 0) {
		throw new ExternalServiceError(provider, "Typing failed: editor is empty before submit");
	}
	if (preSubmitContent.trim().length < prompt.trim().length * 0.9) {
		throw new ExternalServiceError(
			provider,
			`Typing failed: input length ${preSubmitContent.trim().length} is less than 90% of prompt length ${prompt.trim().length}`,
		);
	}

	// Let the provider dismiss autocomplete or do any pre-submit setup.
	await config.beforeSubmitHook?.(page);

	// Find send button AFTER typing (appears dynamically)
	// Wait a bit longer if needed for button to appear
	let sendButton = await findEnabledSendButton(page, provider);
	if (!sendButton) {
		await page.waitForTimeout(500);
		sendButton = await findEnabledSendButton(page, provider);
	}

	const ctx: SubmitContext = {
		page,
		provider,
		input,
		sendButton,
		preSubmitContent,
		preSubmitUrl,
	};

	// Detect bot/CAPTCHA page before attempting submission.
	logger.debug("attempting submission…");
	await detectBotPage(page, provider);

	// Try each submission strategy exactly once — if all fail, throw immediately.
	// Retrying on the same broken page wastes time; the outer retry policy
	// handles recovery by rotating the IP and launching a fresh browser.

	// Shared flag — set by the timeout branch so that any strategy not yet
	// started is skipped rather than firing against a browser being torn down.
	let submissionAborted = false;

	const submitOrder = config.submitOrder ?? ["native", "enter", "dispatch", "force"];
	const needsButton = new Set(["native", "force", "dispatch"]);
	const strategyMap = {
		native: () => (sendButton ? tryNativeClick(ctx) : Promise.resolve(false)),
		enter: () => tryEnterSubmit(ctx),
		force: () => (sendButton ? tryForceClick(ctx) : Promise.resolve(false)),
		dispatch: () => (sendButton ? tryDispatchClick(ctx) : Promise.resolve(false)),
	};

	if (!sendButton) {
		const skipped = submitOrder.filter((s) => needsButton.has(s));
		if (skipped.length > 0) {
			logger.debug(`  ⚠️ no send button — skipping: ${skipped.join(", ")}`);
		}
	}

	const success = await Promise.race([
		(async () => {
			let submitted = false;
			for (const strategy of submitOrder) {
				if (submitted || submissionAborted) break;
				const result = await strategyMap[strategy]();
				if (!result) {
					logger.debug(`  ↩ ${strategy}: returned false`);
				}
				submitted = result;
			}
			return submitted;
		})(),
		new Promise<boolean>((_, reject) =>
			setTimeout(() => {
				submissionAborted = true;
				reject(
					new ExternalServiceError(
						provider,
						`Submission phase timed out after ${SUBMISSION_PHASE_TIMEOUT_MS}ms`,
					),
				);
			}, SUBMISSION_PHASE_TIMEOUT_MS),
		),
	]);

	if (!success) {
		throw new ExternalServiceError(provider, "All submission methods failed");
	}

	// Wait for page stabilization
	await page
		.waitForLoadState("domcontentloaded", { timeout: 5000 })
		.catch(() => {});
	await page
		.waitForLoadState("networkidle", { timeout: NETWORKIDLE_TIMEOUT_MS })
		.catch(() => {});
	await config.afterSubmitHook?.(page);

	logger.log(`post-submit URL: ${page.url()}`);
}
