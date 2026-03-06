import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { env } from "../../env.js";
import { waitForEditorReady } from "../../lib/input/editor/waitForReady.js";
import { findEnabledSendButton } from "../../lib/input/editor/findSendButton.js";
import { clearEditorInput } from "../../lib/input/editor/clearInput.js";
import { detectBotPage } from "../../lib/input/response/detectBotPage.js";
import { logger } from "@oneglanse/utils";
import { PROVIDER_CONFIGS } from "../providers/index.js";
import {
	type SubmitContext,
	tryDispatchClick,
	tryEnterSubmit,
	tryForceClick,
} from "./submitStrategies.js";

const SUBMISSION_PHASE_TIMEOUT_MS = env.SUBMISSION_PHASE_TIMEOUT_MS;
const SUBMISSION_RETRIES = 3;

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

export async function askPrompt(
	page: Page,
	prompt: string,
	provider: Provider,
): Promise<void> {
	const input = await waitForEditorReady(page, provider);

	await clearEditorInput(page, input, { waitAfterMs: 200 });

	for (const char of prompt) {
		if (char === "\n") {
			await page.keyboard.down("Shift");
			await page.keyboard.press("Enter");
			await page.keyboard.up("Shift");
		} else {
			await page.keyboard.type(char);
		}
		// Random delay between keystrokes (25-65ms) to appear less bot-like.
		const typingDelay = 25 + Math.floor(Math.random() * 40);
		await page.waitForTimeout(typingDelay);
	}

	await page.waitForTimeout(500);


	// Store pre-submit state for success detection
	const preSubmitContent = await input.evaluate((el: Element) => {
		if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
			return el.value.trim();
		return (el.textContent || "").trim();
	});
	const preSubmitUrl = page.url();

	// Verify we have content before attempting submission
	if (!preSubmitContent || preSubmitContent.length === 0) {
		throw new ExternalServiceError(provider, "Typing failed: editor did not receive prompt");
	}

	// Let the provider dismiss autocomplete or do any pre-submit setup.
	const config = PROVIDER_CONFIGS[provider];
	await config.beforeSubmitHook?.(page);

	// Find send button AFTER typing (appears dynamically)
	// Wait a bit longer if needed for button to appear
	let sendButton = await findEnabledSendButton(page);
	if (!sendButton) {
		await page.waitForTimeout(500);
		sendButton = await findEnabledSendButton(page);
	}

	const ctx: SubmitContext = {
		page,
		provider,
		input,
		sendButton,
		preSubmitContent,
		preSubmitUrl,
	};

	let success = false;

	for (let attempt = 1; attempt <= SUBMISSION_RETRIES; attempt++) {
		if (attempt > 1) {
			const retryDelay = 250 + attempt * 250;
			logger.warn(
				`submission retry ${attempt}/${SUBMISSION_RETRIES} for ${provider} after ${retryDelay}ms`,
			);
			await page.waitForTimeout(retryDelay);
		}

		sendButton = await findEnabledSendButton(page).catch(() => sendButton);
		ctx.sendButton = sendButton;

		success = await Promise.race([
			(async () => {
				let submitted = await tryEnterSubmit(ctx);
				if (!submitted && sendButton) submitted = await tryForceClick(ctx);
				if (!submitted && sendButton) submitted = await tryDispatchClick(ctx);
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
		]).catch((err) => {
			if (attempt === SUBMISSION_RETRIES) {
				throw err;
			}
			logger.warn(
				`submission attempt ${attempt}/${SUBMISSION_RETRIES} failed for ${provider}: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
			return false;
		});

		if (success) break;
		await detectBotPage(page, provider);
	}

	if (!success) {
		throw new ExternalServiceError(provider, "All submission methods failed");
	}

	// Wait for page stabilization
	await page
		.waitForLoadState("domcontentloaded", { timeout: 20000 })
		.catch(() => {});
	await page.waitForTimeout(2000);
	await page
		.waitForLoadState("networkidle", { timeout: 15000 })
		.catch(() => {});

	logger.log(`post-submit URL: ${page.url()}`);
}
