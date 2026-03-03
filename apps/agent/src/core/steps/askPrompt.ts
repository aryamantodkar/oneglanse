import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { env } from "../../env.js";
import { waitForEditorReady } from "../../lib/input/editor/waitForReady.js";
import { findEnabledSendButton } from "../../lib/input/editor/findSendButton.js";
import { clearEditorInput } from "../../lib/input/editor/clearInput.js";
import {
	type SubmitContext,
	tryDispatchClick,
	tryEnterSubmit,
	tryForceClick,
} from "./submitStrategies.js";

const SUBMISSION_PHASE_TIMEOUT_MS = env.SUBMISSION_PHASE_TIMEOUT_MS;

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
		// Random delay between keystrokes (10-30ms) to appear more human
		const typingDelay = 10 + Math.floor(Math.random() * 20);
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

	const success = await Promise.race([
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
	]);

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
}
