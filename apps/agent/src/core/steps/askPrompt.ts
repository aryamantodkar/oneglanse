import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { env } from "../../env.js";
import {
	humanType,
	moveMouseToElement,
	preInteractionIdle,
	smallScroll,
} from "../../lib/browser/humanBehavior.js";
import { clearEditorInput } from "../../lib/input/editor/clearInput.js";
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

	// Pre-interaction: idle briefly, scroll, then move mouse to input
	logger.debug("pre-interaction idle…");
	await preInteractionIdle(page);
	await smallScroll(page);
	await moveMouseToElement(page, input);

	await clearEditorInput(page, input, { waitAfterMs: 400 });
	// Explicit click re-focuses the element after clear. Without this, React's
	// synthetic event state can desync after a page reset, causing humanType to
	// type into the DOM but readInputValue() to return empty (ChatGPT prompt 2+).
	await input.click();

	logger.debug(`typing ${prompt.length} chars…`);
	await humanType(page, prompt);
	logger.debug("typing complete");

	await page.waitForTimeout(randomBetween(300, 700));
	await config.afterTypingHook?.(page);

	// Store pre-submit state for success detection
	const preSubmitContent = await input.readInputValue();
	const preSubmitUrl = page.url();

	// Verify we have content before attempting submission
	if (!preSubmitContent || preSubmitContent.length === 0) {
		throw new ExternalServiceError(
			provider,
			"Typing failed: editor did not receive prompt",
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

	const success = await Promise.race([
		(async () => {
			let submitted = false;
			if (sendButton) submitted = await tryNativeClick(ctx);
			if (!submitted && sendButton) submitted = await tryForceClick(ctx);
			if (!submitted && sendButton) submitted = await tryDispatchClick(ctx);
			if (!submitted) submitted = await tryEnterSubmit(ctx);
			return submitted;
		})(),
		new Promise<boolean>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new ExternalServiceError(
							provider,
							`Submission phase timed out after ${SUBMISSION_PHASE_TIMEOUT_MS}ms`,
						),
					),
				SUBMISSION_PHASE_TIMEOUT_MS,
			),
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
