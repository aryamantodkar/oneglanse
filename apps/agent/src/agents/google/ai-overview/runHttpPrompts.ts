import type { AskPromptResult, UserPrompt } from "@onescope/types";
import { fetchProxies } from "../../../lib/browser/proxy/pool.js";
import { logger } from "../../../lib/utils/logger.js";
import { RateLimitedError, searchGoogleAIOverview } from "./lib/searchGoogle.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;
const RATE_LIMIT_BACKOFF_MS = 8_000; // base backoff when Google 429s — multiplied by attempt

/**
 * Runs HTTP-based (curl_cffi) Google AI Overview search for each prompt.
 * Retries up to MAX_RETRIES times per prompt, rotating the proxy pool on failure.
 */
export async function runHttpPrompts(
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

				if (err instanceof RateLimitedError) {
					// Proxy is fine — Google rate-limited the request.
					// Backing off is more effective than burning through proxies.
					const backoffMs = RATE_LIMIT_BACKOFF_MS * attempt;
					logger.warn(
						`[google-ai-overview] Rate limited, attempt ${attempt}/${MAX_RETRIES} — backing off ${backoffMs / 1000}s`,
					);
					if (attempt < MAX_RETRIES) {
						await new Promise((r) => setTimeout(r, backoffMs));
					}
				} else {
					// Real failure (network, parse error) — rotate to a different proxy
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
