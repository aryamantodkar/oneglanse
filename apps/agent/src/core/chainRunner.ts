import { toErrorMessage } from "@oneglanse/errors";
import type { AskPromptResult, PromptPayload, Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { createAgent } from "./createAgent.js";
import { setupProviderPage } from "./createAgent.js";
import { runAgents } from "./runAgents.js";

export type ChainHooks = {
	onProviderStart?: (provider: Provider) => Promise<void>;
	onProviderDone?: (provider: Provider, results: AskPromptResult[]) => Promise<void>;
};

/**
 * Runs all providers sequentially on a single browser / single IP.
 * Chain order: first provider launches the browser; subsequent providers
 * open new pages on the same context (preserving cookies, history, IP).
 * Per-provider failures are isolated — the chain continues to the next provider.
 * The browser is always closed in the finally block regardless of outcome.
 */
export async function runProviderChain(
	providers: Provider[],
	payload: PromptPayload,
	hooks?: ChainHooks,
): Promise<Record<Provider, AskPromptResult[]>> {
	const results: Partial<Record<Provider, AskPromptResult[]>> = {};

	if (providers.length === 0) return results as Record<Provider, AskPromptResult[]>;

	const [firstProvider, ...restProviders] = providers as [Provider, ...Provider[]];

	// createAgent launches the browser, context, and navigates the first page.
	// On failure it cleans up internally and re-throws — no teardown needed here.
	const { browser, context, page: firstPage, cleanup } = await createAgent(firstProvider);

	try {
		await hooks?.onProviderStart?.(firstProvider);
		try {
			results[firstProvider] = await runAgents(payload, firstPage, firstProvider);
		} catch (err) {
			logger.error(`[chain:${firstProvider}] failed: ${toErrorMessage(err)}`);
			results[firstProvider] = [];
		}
		await hooks?.onProviderDone?.(firstProvider, results[firstProvider]!);
		await firstPage.close().catch(() => {});

		for (const provider of restProviders) {
			let providerPage: Page | null = null;
			try {
				await hooks?.onProviderStart?.(provider);
				const { page } = await setupProviderPage(context, provider);
				providerPage = page;
				results[provider] = await runAgents(payload, providerPage, provider);
			} catch (err) {
				logger.error(`[chain:${provider}] failed: ${toErrorMessage(err)}`);
				results[provider] = [];
			} finally {
				await providerPage?.close().catch(() => {});
			}
			await hooks?.onProviderDone?.(provider, results[provider]!);
		}
	} finally {
		await context.close().catch(() => {});
		await browser.close().catch(() => {});
		await cleanup().catch(() => {});
	}

	return results as Record<Provider, AskPromptResult[]>;
}
