import type { AskPromptResult, UserPrompt } from "@onescope/types";
import { fetchProxies } from "../../../lib/browser/proxy/pool.js";
import { logger } from "../../../lib/utils/logger.js";
import { searchGoogleAIOverview } from "./lib/cdpSearch.js";

// Configurable via env — defaults to 10 to match the proxy rotation budget
// other providers get via IPRefreshNeededError cycling.
const MAX_RETRIES = Number(process.env.MAX_GOOGLE_AI_OVERVIEW_RETRIES ?? 10);
const RETRY_DELAY_MS = 2_000;

/**
 * Runs CDP-based Google AI Overview search for each prompt.
 *
 * Retry semantics:
 *   - null result (page loaded, no AI Overview): retry with a different proxy
 *     but do NOT count the proxy as failed. After MAX_RETRIES nulls, accept
 *     an empty response — the query likely doesn't trigger AI Overview.
 *   - thrown error (navigation timeout, CDP failure): proxy already penalised
 *     by cdpSearch; retry up to MAX_RETRIES then accept empty response.
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
		let result: AskPromptResult | null = null;
		let noOverviewCount = 0;

		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				result = await searchGoogleAIOverview(userId, workspaceId, id, prompt);

				if (result !== null) {
					// Got a real AI Overview response
					break;
				}

				// null = proxy healthy but no AI Overview for this query/proxy combo
				noOverviewCount++;
				logger.warn(
					`[google-ai-overview] No AI Overview on attempt ${attempt}/${MAX_RETRIES} for "${prompt.slice(0, 40)}..." — rotating proxy`,
				);
			} catch (err: any) {
				logger.warn(
					`[google-ai-overview] Attempt ${attempt}/${MAX_RETRIES} failed for "${prompt.slice(0, 40)}...": ${err?.message}`,
				);
			}

			if (attempt < MAX_RETRIES) {
				try {
					await fetchProxies({ forceRefresh: true });
				} catch {
					// Non-fatal — continue with existing pool
				}
				await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
			}
		}

		if (result !== null) {
			results.push(result);
		} else {
			// All attempts exhausted — push an empty result rather than failing the job.
			// This can happen for queries that don't reliably trigger AI Overview or
			// when all available proxies are flagged by Google at this moment.
			const reason = noOverviewCount === MAX_RETRIES ? "no AI Overview found" : "all attempts errored";
			logger.warn(
				`[google-ai-overview] Accepting empty result for "${prompt.slice(0, 40)}..." after ${MAX_RETRIES} attempts (${reason})`,
			);
			results.push({
				userId,
				workspaceId,
				promptId: id,
				prompt,
				response: "",
				sources: [],
			});
		}
	}

	return results;
}
