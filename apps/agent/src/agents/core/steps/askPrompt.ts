import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { waitForEditorReady } from "../../../lib/input/editor/waitForReady.js";
import { findEnabledSendButton } from "../../../lib/input/editor/findSendButton.js";
import { logger } from "../../../lib/utils/logger.js";
import {
	type SubmitContext,
	tryDispatchClick,
	tryEnterSubmit,
	tryForceClick,
} from "./submitStrategies.js";

const SUBMISSION_PHASE_TIMEOUT_MS = Number(
	process.env.SUBMISSION_PHASE_TIMEOUT_MS ?? 30000,
);

export async function askPrompt(
	page: Page,
	prompt: string,
	provider: Provider,
): Promise<void> {
	logger.debug(
		`\n💬 Asking: "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`,
	);

	if (provider === "google-ai-overview") {
		const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(prompt)}&hl=en&pws=0`;
		logger.debug(`  🔎 Navigating via Google query URL: ${searchUrl.slice(0, 120)}`);
		await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
		await page
			.locator(
				'button:has-text("Accept all"), button#L2AGLb, [jsname="b3VHJd"]',
			)
			.first()
			.click({ timeout: 3000 })
			.catch(() => null);
		await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
		return;
	}

	const input = await waitForEditorReady(page, provider);

	logger.debug("Typing Prompt");

	await input.click({ force: true });
	await page.waitForTimeout(100);

	await input.evaluate((el) => {
		if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
			el.value = "";
		} else if (el instanceof HTMLElement) {
			el.innerText = "";
		}
	});

	const isMac = process.platform === "darwin";
	await page.keyboard.down(isMac ? "Meta" : "Control");
	await page.keyboard.press("KeyA");
	await page.keyboard.up(isMac ? "Meta" : "Control");
	await page.keyboard.press("Backspace");
	await page.waitForTimeout(200);

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

	logger.debug("  📤 Submitting...");

	// Store pre-submit state for success detection
	const preSubmitContent = await input.evaluate((el) => {
		if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
			return el.value.trim();
		return (el.textContent || "").trim();
	});
	const preSubmitUrl = page.url();

	// Verify we have content before attempting submission
	if (!preSubmitContent || preSubmitContent.length === 0) {
		throw new Error(
			`[${provider}] Typing failed: editor did not receive prompt`,
		);
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
						new Error(
							`[${provider}] Submission phase timed out after ${SUBMISSION_PHASE_TIMEOUT_MS}ms`,
						),
					),
				SUBMISSION_PHASE_TIMEOUT_MS,
			),
		),
	]);

	if (!success) {
		throw new Error(`[${provider}] All submission methods failed`);
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
