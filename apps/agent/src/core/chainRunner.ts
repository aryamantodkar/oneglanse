import { toErrorMessage } from "@oneglanse/errors";
import type { AskPromptResult, PromptPayload, Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { createAgent } from "./createAgent.js";
import { runAgents } from "./runAgents.js";

export type ChainHooks = {
	onProviderStart?: (provider: Provider) => Promise<void>;
	onProviderDone?: (provider: Provider, results: AskPromptResult[]) => Promise<void>;
};

/**
 * Runs all providers in parallel — each gets its own browser and proxy IP
 * (sticky-sessioned to the provider name so IPs stay stable per-provider).
 * Per-provider failures are isolated; the rest continue unaffected.
 * All browsers are closed in finally blocks regardless of outcome.
 */
export async function runProviderChain(
	providers: Provider[],
	payload: PromptPayload,
	hooks?: ChainHooks,
): Promise<Record<Provider, AskPromptResult[]>> {
	if (providers.length === 0) return {} as Record<Provider, AskPromptResult[]>;

	const settled = await Promise.allSettled(
		providers.map(async (provider) => {
			let agentRefs: Awaited<ReturnType<typeof createAgent>> | null = null;
			let providerResults: AskPromptResult[] = [];

			await hooks?.onProviderStart?.(provider);

			try {
				agentRefs = await createAgent(provider);
				providerResults = await runAgents(payload, agentRefs.page, provider);
			} catch (err) {
				logger.error(`[chain:${provider}] failed: ${toErrorMessage(err)}`);
			} finally {
				if (agentRefs) {
					await agentRefs.page.close().catch(() => {});
					await agentRefs.context.close().catch(() => {});
					await agentRefs.browser.close().catch(() => {});
					await agentRefs.cleanup().catch(() => {});
				}
			}

			await hooks?.onProviderDone?.(provider, providerResults);
			return { provider, results: providerResults };
		}),
	);

	const results: Partial<Record<Provider, AskPromptResult[]>> = {};
	for (const outcome of settled) {
		if (outcome.status === "fulfilled") {
			results[outcome.value.provider] = outcome.value.results;
		} else {
			// onProviderDone threw — extract provider from rejection if possible
			logger.error(`[chain] provider hook error: ${toErrorMessage(outcome.reason)}`);
		}
	}

	return results as Record<Provider, AskPromptResult[]>;
}
