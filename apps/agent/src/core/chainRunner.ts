import { toErrorMessage } from "@oneglanse/errors";
import type {
	AskPromptResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { createAgent } from "./createAgent.js";
import { runAgents } from "./runAgents.js";

export type ChainHooks = {
	onProviderStart?: (provider: Provider) => Promise<void>;
	onProviderDone?: (
		provider: Provider,
		results: AskPromptResult[],
	) => Promise<void>;
};

function randomBetween(min: number, max: number): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Runs providers sequentially with a small randomized cooldown between them.
 * This avoids cross-provider request bursts from the same VPS and reduces
 * correlation risk when the deployment is backed by one proxy source.
 */
export async function runProviderChain(
	providers: Provider[],
	payload: PromptPayload,
	hooks?: ChainHooks,
): Promise<Record<Provider, AskPromptResult[]>> {
	if (providers.length === 0) return {} as Record<Provider, AskPromptResult[]>;

	const results: Partial<Record<Provider, AskPromptResult[]>> = {};

	for (const [index, provider] of providers.entries()) {
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
		results[provider] = providerResults;

		if (index < providers.length - 1) {
			await new Promise((resolve) =>
				setTimeout(resolve, randomBetween(2_500, 6_500)),
			);
		}
	}

	return results as Record<Provider, AskPromptResult[]>;
}
