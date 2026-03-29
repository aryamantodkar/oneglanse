import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Locator, Page } from "playwright";
import {
	clickLocatorLikeUser,
	pastePrompt,
} from "../../browser/humanBehavior.js";
import { clearEditorInput } from "./clearInput.js";

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

export function normalizePromptValue(text: string): string {
	return text
		.replace(/\r\n/g, "\n")
		.replace(/\u00a0/g, " ")
		.replace(/[\u200b-\u200d\ufeff]/g, "")
		.trim();
}

export function getPromptInsertionStrategy(): "pacedPaste" {
	return "pacedPaste";
}

async function focusEditorTarget(page: Page, input: Locator): Promise<void> {
	await input.scrollIntoViewIfNeeded().catch(() => null);
	await clickLocatorLikeUser(page, input, {
		timeout: 3000,
		delay: randomBetween(25, 80),
	}).catch(() => null);
	await page.waitForTimeout(randomBetween(40, 120));
	await input.focus().catch(() => null);
	await page.waitForTimeout(randomBetween(30, 90));
}

export async function prepareEditorForPrompt(
	page: Page,
	input: Locator,
	provider: Provider,
): Promise<void> {
	const count = await input.count().catch(() => 0);
	if (count === 0) {
		throw new ExternalServiceError(
			provider,
			`Editor not ready for ${provider}: input locator is missing`,
		);
	}

	const state = await input.getEditableState().catch(() => null);
	if (
		!(
			state?.connected &&
			state.editable &&
			state.enabled &&
			state.acceptsTextInput
		)
	) {
		throw new ExternalServiceError(
			provider,
			`Editor not ready for ${provider}: input is not editable`,
		);
	}

	await focusEditorTarget(page, input);

	const existingValue = await input.readInputValue().catch(() => "");
	if (normalizePromptValue(existingValue).length === 0) {
		await focusEditorTarget(page, input);
		return;
	}

	const cleared = await clearEditorInput(page, input, {
		clickTimeoutMs: 3000,
		waitAfterMs: randomBetween(40, 120),
	});
	if (!cleared) {
		throw new ExternalServiceError(
			provider,
			`Editor not ready for ${provider}: could not clear existing input`,
		);
	}

	const remainingValue = await input.readInputValue().catch(() => "");
	if (normalizePromptValue(remainingValue).length > 0) {
		throw new ExternalServiceError(
			provider,
			`Editor not ready for ${provider}: input retained content after clear`,
		);
	}

	await focusEditorTarget(page, input);
}

async function insertPromptOnce(page: Page, prompt: string): Promise<void> {
	await pastePrompt(page, prompt);
}

export async function insertPromptIntoEditor(
	page: Page,
	input: Locator,
	prompt: string,
	provider: Provider,
): Promise<{ rawValue: string; strategy: "pacedPaste" }> {
	const strategy = getPromptInsertionStrategy();
	const expectedValue = normalizePromptValue(prompt);

	for (let attempt = 1; attempt <= 2; attempt++) {
		await prepareEditorForPrompt(page, input, provider);
		await insertPromptOnce(page, prompt);
		await page.waitForTimeout(randomBetween(80, 160));

		const rawValue = await input.readInputValue().catch(() => "");
		if (normalizePromptValue(rawValue) === expectedValue) {
			return { rawValue, strategy };
		}

		if (attempt === 1) {
			logger.warn(
				`[${provider}] prompt verification mismatch after pasting — retrying local overwrite once`,
			);
		}
	}

	const finalValue = await input.readInputValue().catch(() => "");
	throw new ExternalServiceError(
		provider,
		`Typing failed: normalized input mismatch after local retry (expected ${expectedValue.length} chars, got ${normalizePromptValue(finalValue).length})`,
	);
}
