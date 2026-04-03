import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import {
	moveMouseToElement,
	preInteractionIdle,
	smallScroll,
} from "../../lib/browser/humanBehavior.js";
import { findEnabledSendButton } from "../../lib/input/editor/findSendButton.js";
import {
	insertPromptIntoEditor,
	normalizePromptValue,
} from "../../lib/input/editor/promptInput.js";
import { waitForEditorReady } from "../../lib/input/editor/waitForReady.js";
import { primeSelectorProfile } from "../../lib/selectors/intelligence.js";
import { detectBotPage } from "../../lib/input/response/detectBotPage.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";
import {
	type SubmitContext,
	tryDispatchClick,
	tryEnterSubmit,
	tryForceClick,
	tryNativeClick,
} from "./submitStrategies.js";

const SUBMISSION_PHASE_TIMEOUT_MS = 30_000;
const CAMOUFOX_HUMANIZE = true;

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
	if (!CAMOUFOX_HUMANIZE && Math.random() < 0.4) await smallScroll(page);
	if (!CAMOUFOX_HUMANIZE && Math.random() < 0.6) {
		await moveMouseToElement(page, input);
	}

	logger.log(`[${provider}] typing prompt (${prompt.length} chars)`);
	const { rawValue: insertedValue } = await insertPromptIntoEditor(
		page,
		input,
		prompt,
		provider,
	);

	await page.waitForTimeout(randomBetween(300, 700));
	await config.afterTypingHook?.(page);

	// Store pre-submit state for success detection
	const preSubmitContent = await input
		.readInputValue()
		.catch(() => insertedValue);
	const preSubmitUrl = page.url();

	if (
		!preSubmitContent ||
		normalizePromptValue(preSubmitContent).length === 0
	) {
		throw new ExternalServiceError(
			provider,
			"Typing failed: editor is empty before submit",
		);
	}
	if (normalizePromptValue(preSubmitContent) !== normalizePromptValue(prompt)) {
		throw new ExternalServiceError(
			provider,
			`Typing failed: normalized input mismatch before submit (expected ${normalizePromptValue(prompt).length} chars, got ${normalizePromptValue(preSubmitContent).length})`,
		);
	}

	// Let the provider dismiss autocomplete or do any pre-submit setup.
	await config.beforeSubmitHook?.(page);

	const ctx: SubmitContext = {
		page,
		provider,
		input,
		sendButton: null,
		preSubmitContent,
		preSubmitUrl,
	};

	await detectBotPage(page, provider);

	// Try each submission strategy exactly once — if all fail, throw immediately.
	// Retrying on the same broken page wastes time; the outer retry policy
	// handles recovery by rotating the IP and launching a fresh browser.

	// Shared flag — set by the timeout branch so that any strategy not yet
	// started is skipped rather than firing against a browser being torn down.
	let submissionAborted = false;

	type SubmitStrategy = "native" | "enter" | "force" | "dispatch";
	const configuredSubmitOrder: SubmitStrategy[] = config.submitOrder ?? [
		"native",
		"enter",
		"force",
		"dispatch",
	];
	const needsButton = new Set<SubmitStrategy>(["native", "force", "dispatch"]);
	const strategyMap: Record<SubmitStrategy, () => Promise<boolean>> = {
		native: () => (ctx.sendButton ? tryNativeClick(ctx) : Promise.resolve(false)),
		enter: () => tryEnterSubmit(ctx),
		force: () => (ctx.sendButton ? tryForceClick(ctx) : Promise.resolve(false)),
		dispatch: () =>
			ctx.sendButton ? tryDispatchClick(ctx) : Promise.resolve(false),
	};
	const buttonSubmitOrder = configuredSubmitOrder.filter((strategy) =>
		needsButton.has(strategy),
	);

	const success = await Promise.race([
		(async () => {
			if (configuredSubmitOrder.includes("enter") && !submissionAborted) {
				const enterSubmitted = await strategyMap.enter();
				if (enterSubmitted) {
					return true;
				}
				logger.debug("  ↩ enter: returned false");
			}

			if (buttonSubmitOrder.length === 0 || submissionAborted) {
				return false;
			}

			void primeSelectorProfile(page, provider, "submit");
			let sendButton = await findEnabledSendButton(page, provider);
			if (!sendButton) {
				await page.waitForTimeout(500);
				sendButton = await findEnabledSendButton(page, provider);
			}
			ctx.sendButton = sendButton;

			if (!ctx.sendButton) {
				logger.debug(
					`  ⚠️ no send button after typed-state scan — skipping: ${buttonSubmitOrder.join(", ")}`,
				);
				return false;
			}

			for (const strategy of buttonSubmitOrder) {
				if (submissionAborted) break;
				const result = await strategyMap[strategy]();
				if (result) {
					return true;
				}
				logger.debug(`  ↩ ${strategy}: returned false`);
			}
			return false;
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
	// Chat providers keep long-lived connections open, so waiting for networkidle
	// adds an avoidable fixed delay after every successful submit. A short settle
	// is enough before provider-specific post-submit hooks run.
	await page.waitForTimeout(150);
	await config.afterSubmitHook?.(page);

	logger.log(`[${provider}] prompt submitted: ${page.url()}`);
}
