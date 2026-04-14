import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, withTimeout } from "@oneglanse/utils";
import type { Page } from "playwright";
import {
	moveMouseToElement,
	preInteractionIdle,
	randomBetween,
	smallScroll,
} from "../../lib/browser/humanBehavior.js";
import { findEnabledSendButton } from "../../lib/input/editor/findSendButton.js";
import { ensureEditorNotBlocked } from "../../lib/input/editor/assertNotBlocked.js";
import {
	insertPromptIntoEditor,
	normalizePromptValue,
} from "../../lib/input/editor/promptInput.js";
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
const SUBMISSION_PHASE_TIMEOUT_MS = 30_000;
const HOOK_TIMEOUT_MS = 10_000;
const TYPE_PHASE_TIMEOUT_MS = 25_000;
const POST_SUBMIT_STABILIZE_TIMEOUT_MS = 12_000;
const CAMOUFOX_HUMANIZE = true;

export async function askPrompt(
	page: Page,
	prompt: string,
	provider: Provider,
): Promise<void> {
	const config = PROVIDER_CONFIGS[provider];
	await withTimeout(
		`[${provider}] beforePromptHook`,
		async () => {
			await config.beforePromptHook?.(page);
		},
		HOOK_TIMEOUT_MS,
	);

	let input = await withTimeout(
		`[${provider}] waitForEditorReady`,
		async () => await waitForEditorReady(page, provider),
		TYPE_PHASE_TIMEOUT_MS,
	);

	try {
		await ensureEditorNotBlocked(page, input, provider);
	} catch (err) {
		if (config.beforeRetryHook) {
			logger.warn(`editor blocked for ${provider} — refreshing page immediately`);
			await config.beforeRetryHook(page);
			const refreshedInput = await withTimeout(
				`[${provider}] waitForEditorReady after refresh`,
				async () => await waitForEditorReady(page, provider),
				TYPE_PHASE_TIMEOUT_MS,
			);
			await ensureEditorNotBlocked(page, refreshedInput, provider);
			input = refreshedInput;
		} else {
			throw err;
		}
	}

	await preInteractionIdle(page);
	if (!CAMOUFOX_HUMANIZE && Math.random() < 0.4) await smallScroll(page);
	if (!CAMOUFOX_HUMANIZE && Math.random() < 0.6) {
		await moveMouseToElement(page, input);
	}

	logger.debug(`pasting ${prompt.length} chars…`);
	const { rawValue: insertedValue } = await withTimeout(
		`[${provider}] insertPromptIntoEditor`,
		async () =>
			await insertPromptIntoEditor(
				page,
				input,
				prompt,
				provider,
			),
		TYPE_PHASE_TIMEOUT_MS,
	);
	logger.debug(`pasting ${prompt.length} chars complete`);

	await page.waitForTimeout(randomBetween(300, 700));
	await withTimeout(
		`[${provider}] afterTypingHook`,
		async () => {
			await config.afterTypingHook?.(page);
		},
		HOOK_TIMEOUT_MS,
	);

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
	await withTimeout(
		`[${provider}] beforeSubmitHook`,
		async () => {
			await config.beforeSubmitHook?.(page);
		},
		HOOK_TIMEOUT_MS,
	);

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

	type SubmitStrategy = "native" | "enter" | "force" | "dispatch";
	const submitOrder: SubmitStrategy[] = config.submitOrder ?? [
		"enter",
		"native",
		"force",
		"dispatch",
	];
	const needsButton = new Set<SubmitStrategy>(["native", "force", "dispatch"]);
	const strategyMap: Record<SubmitStrategy, () => Promise<boolean>> = {
		native: () => (sendButton ? tryNativeClick(ctx) : Promise.resolve(false)),
		enter: () => tryEnterSubmit(ctx),
		force: () => (sendButton ? tryForceClick(ctx) : Promise.resolve(false)),
		dispatch: () =>
			sendButton ? tryDispatchClick(ctx) : Promise.resolve(false),
	};

	if (!sendButton) {
		const skipped = submitOrder.filter((s) => needsButton.has(s));
		if (skipped.length > 0) {
			logger.debug(`  ⚠️ no send button — skipping: ${skipped.join(", ")}`);
		}
	}

	const effectiveSubmitOrder: SubmitStrategy[] = sendButton
		? submitOrder
		: submitOrder.includes("enter")
			? ["enter"]
			: [];

	const success = await Promise.race([
		(async () => {
			let submitted = false;
			for (const strategy of effectiveSubmitOrder) {
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
	await withTimeout(
		`[${provider}] post-submit stabilization`,
		async () => {
			await page
				.waitForLoadState("networkidle", { timeout: NETWORKIDLE_TIMEOUT_MS })
				.catch(() => {});
			await config.afterSubmitHook?.(page);
		},
		POST_SUBMIT_STABILIZE_TIMEOUT_MS,
	);

	logger.log(`post-submit URL: ${page.url()}`);
}
