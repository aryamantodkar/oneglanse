import type { AskPromptResult, UserPrompt } from "@onescope/types";
import { fetchProxies } from "../../../lib/browser/proxy/pool.js";
import { logger } from "../../../lib/utils/logger.js";
import { searchGoogleAIOverview } from "./lib/cdpSearch.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

/**
 * Runs CDP-based Google AI Overview search for each prompt.
 * Retries up to MAX_RETRIES times per prompt, rotating the proxy pool on failure.
 * Returns partial results — succeeded prompts are stored even if some fail.
 */
export async function runGoogleAIOverview(
	prompts: UserPrompt[],
	userId: string,
	workspaceId: string,
): Promise<AskPromptResult[]> {
	// Ensure proxy pool is populated before we start
	try {
		await fetchProxies({ resetBadProxies: false });
		logger.log("[google-ai-overview] Initialized proxy pool");
	} catch (err: any) {
		logger.warn(`[google-ai-overview] Could not fetch proxies: ${err?.message}`);
	}

	const results: AskPromptResult[] = [];

	for (const { id, prompt } of prompts) {
		let lastError: Error | null = null;
		let succeeded = false;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const result = await searchGoogleAIOverview(userId, workspaceId, id, prompt);
				results.push(result);
				succeeded = true;
				break;
			} catch (err: any) {
				lastError = err instanceof Error ? err : new Error(String(err));

				logger.warn(
					`[google-ai-overview] Attempt ${attempt}/${MAX_RETRIES} failed for prompt "${prompt.slice(0, 40)}...": ${lastError.message}`,
				);

				if (attempt < MAX_RETRIES) {
					try {
						await fetchProxies({ forceRefresh: true });
					} catch {
						// Non-fatal — continue with existing pool
					}
					await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
				}
			}
		}

		if (!succeeded) {
			logger.error(
				`[google-ai-overview] All ${MAX_RETRIES} attempts failed for prompt "${prompt.slice(0, 40)}...": ${lastError?.message}`,
			);
			// Skip this prompt — partial results are still stored for other prompts
		}
	}

	return results;
}
