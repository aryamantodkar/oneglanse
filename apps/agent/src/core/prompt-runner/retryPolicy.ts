import {
	classifyError,
	IPRefreshNeededError,
	toErrorMessage,
	ValidationError,
} from "@oneglanse/errors";
import { exponentialBackoff, logger } from "@oneglanse/utils";
import type { AskPromptResult, PromptPayload, Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { env } from "../../env.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";
import { executePrompt } from "./executePrompt.js";

const MAX_RETRIES = env.MAX_PROMPT_RETRIES_PER_IP;
const INITIAL_RETRY_DELAY = env.PROMPT_RETRY_DELAY_MS;
const MAX_RETRY_DELAY = env.MAX_PROMPT_RETRY_DELAY_MS;

// Canary policy: the first prompt on an unproven proxy gets exactly one shot.
// A single success "proves" the proxy and unlocks MAX_RETRIES for all subsequent prompts.
const CANARY_MAX_ATTEMPTS = 1;

// Identifies extraction and validation failures that warrant a log warning.
const EXTRACTION_FAILURE_RE =
	/Markdown response extraction failed|Empty response extracted|Invalid response/i;

function buildIPRotationError(
	message: string,
	partialResults: AskPromptResult[],
	remainingPrompts: PromptPayload["prompts"],
	failedPromptIndex: number,
	err: unknown,
): IPRefreshNeededError {
	return new IPRefreshNeededError(
		message,
		partialResults,
		remainingPrompts,
		failedPromptIndex,
		classifyError(err),
	);
}

/**
 * Runs a single prompt through the retry loop with the canary proxy policy applied.
 *
 * Canary policy:
 *   - Unproven proxy → one attempt only. Failure triggers immediate IP rotation.
 *   - Proven proxy   → up to MAX_RETRIES attempts with exponential backoff.
 *
 * The provider's `beforeRetryHook` is called before each retry so providers can
 * reset their page state without any of that logic living here.
 *
 * Throws IPRefreshNeededError on terminal failure so the caller can rotate the proxy.
 */
export async function executePromptWithRetry(
	page: Page,
	promptEntry: NonNullable<PromptPayload["prompts"][number]>,
	provider: Provider,
	userId: string,
	workspaceId: string,
	promptIndex: number,
	totalPrompts: number,
	partialResults: AskPromptResult[],
	remainingPrompts: PromptPayload["prompts"],
	proxyProven: boolean,
): Promise<{ result: AskPromptResult; proxyNowProven: boolean }> {
	const config = PROVIDER_CONFIGS[provider];
	const maxAttempts = proxyProven ? MAX_RETRIES : CANARY_MAX_ATTEMPTS;
	let lastError: unknown = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		if (attempt > 1) {
			const backoffDelay = exponentialBackoff(attempt - 2, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY);
			logger.log(
				`🔄 Retry attempt ${attempt}/${maxAttempts} for prompt ${promptIndex + 1} (waiting ${backoffDelay / 1000}s)`,
			);
			await page.waitForTimeout(backoffDelay);
			await config.beforeRetryHook?.(page);
		}

		try {
			const { response, sources } = await executePrompt(page, promptEntry.prompt, provider);

			logger.success(
				`✓ Prompt ${promptIndex + 1}/${totalPrompts} completed${attempt > 1 ? ` (succeeded on retry ${attempt})` : ""}`,
			);

			const result: AskPromptResult = {
				userId,
				workspaceId,
				promptId: promptEntry.id,
				prompt: promptEntry.prompt,
				response,
				sources,
			};

			const proxyNowProven = !proxyProven;
			if (proxyNowProven) {
				logger.log(
					"✅ Proxy proven good after canary prompt — full retries enabled for remaining prompts",
				);
			}

			return { result, proxyNowProven };
		} catch (err) {
			lastError = err;
			logger.error(
				`❌ Attempt ${attempt}/${maxAttempts} failed for prompt ${promptIndex + 1}: [${provider}] ${toErrorMessage(err)}`,
			);

			// Canary failed: rotate IP immediately, no retry.
			if (!proxyProven) {
				logger.warn("⚡ Canary prompt failed on unproven proxy — rotating IP immediately");
				throw buildIPRotationError(
					`${provider} canary prompt failed — rotating IP. Error: ${toErrorMessage(lastError)}`,
					partialResults,
					remainingPrompts,
					promptIndex,
					lastError,
				);
			}

			if (EXTRACTION_FAILURE_RE.test(toErrorMessage(err))) {
				logger.warn(
					`⚠️ Repeated extraction failure on current IP (prompt ${promptIndex + 1}, attempt ${attempt}/${maxAttempts})`,
				);
			}

			if (attempt === maxAttempts) {
				logger.error(
					`🔴 Prompt ${promptIndex + 1} failed after ${maxAttempts} attempts. Final error: ${toErrorMessage(lastError)}`,
				);
				logger.error("🔴 Triggering IP refresh for remaining prompts.");
				throw buildIPRotationError(
					`${provider} failed ${maxAttempts} consecutive attempts — refreshing IP. Last error: ${toErrorMessage(lastError)}`,
					partialResults,
					remainingPrompts,
					promptIndex,
					lastError,
				);
			}
		}
	}

	// Unreachable — the loop always returns or throws.
	throw new ValidationError("executePromptWithRetry: unexpected exit without result or error");
}
