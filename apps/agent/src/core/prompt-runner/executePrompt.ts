import { ExternalServiceError, ValidationError } from "@oneglanse/errors";
import type { Provider, Source } from "@oneglanse/types";
import type { Page } from "playwright";
import { logger, validateResponse } from "@oneglanse/utils";
import { askPrompt } from "../steps/askPrompt.js";
import { checkAndExtractSources } from "../steps/extractSources.js";
import { fetchPromptResponses } from "../steps/fetchPromptResponses.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";

/**
 * Runs one full prompt cycle for a single prompt:
 *   1. Type and submit the prompt (or navigate directly if navigateToPrompt is set)
 *   2. Wait for the response to finish generating
 *   3. Extract and validate the response text
 *   4. Extract citation sources
 *
 * Has no knowledge of retries or backoff — throws on failure so the
 * caller's retry policy can decide whether to retry or escalate.
 */
export async function executePrompt(
	page: Page,
	prompt: string,
	provider: Provider,
): Promise<{ response: string; sources: Source[] }> {
	const config = PROVIDER_CONFIGS[provider];
	if (config.navigateToPrompt) {
		await config.navigateToPrompt(page, prompt);
	} else {
		await askPrompt(page, prompt, provider);
	}

	const response = await fetchPromptResponses(page, provider);
	if (!response || response.trim().length === 0) {
		throw new ExternalServiceError(
			provider,
			"Empty response extracted; blocking source extraction and retrying prompt",
		);
	}

	const validation = validateResponse(response, provider);
	if (!validation.valid) {
		logger.warn(
			`invalid response (${response.trim().length} chars): ${validation.reason} — retrying`,
		);
		throw new ValidationError(`[${provider}] Invalid response: ${validation.reason}`, {
			provider,
			reason: validation.reason,
		});
	}

	const sources = await checkAndExtractSources(page, provider);

	return { response, sources };
}
