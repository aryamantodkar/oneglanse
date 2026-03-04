import { toErrorMessage } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import { runWithProvider } from "../lib/providerContext.js";
import type { AskPromptResult, PromptPayload, Provider } from "@oneglanse/types";
import { fetchProxies } from "../lib/browser/proxy/pool.js";
import { type AgentFactory, runWithProxyPool } from "../lib/browser/proxy/runner.js";
import { getWarmBrowser } from "../lib/browser/warmPool.js";
import { PROVIDER_CONFIGS } from "./providers/index.js";
import { navigateWithRetry } from "../lib/browser/navigate.js";

export async function agentHandler(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
): Promise<AskPromptResult[]> {
	return runWithProvider(provider, async () => {
	try {
		// No resetBadProxies: module-level proxyRecords in pool.ts persist across
		// all providers and job runs, so scores accumulate naturally.
		await fetchProxies();
		logger.log("proxy pool ready");
	} catch (err) {
		logger.error("failed to initialize proxy pool:", toErrorMessage(err));
	}

	// Wrap agentFactory with warm-pool awareness: if a healthy browser already
	// exists for this provider, navigate it to a clean slate and reuse it,
	// saving browser launch + warmup cost (~3-5s). Falls back to a cold factory
	// on any failure — existing proxy retry logic handles the rest.
	const warmFactory: AgentFactory = async () => {
		const warm = await getWarmBrowser(provider).catch(() => null);
		if (warm) {
			const config = PROVIDER_CONFIGS[provider];
			try {
				await navigateWithRetry(warm.page, config.url, {
					waitUntil: "domcontentloaded",
					timeout: 30_000,
				});
				if (config.postNavigationHook) {
					await config.postNavigationHook(warm.page);
				}
				return {
					browser: warm.browser,
					context: warm.context,
					page: warm.page,
					proxy: warm.proxy ?? undefined,
					cleanup: warm.cleanup ?? undefined,
				};
			} catch {
				// Navigation on warm browser failed — close and fall through to cold factory.
				await warm.cleanup?.().catch(() => {});
				await warm.context?.close().catch(() => {});
				await warm.browser?.close().catch(() => {});
			}
		}
		return agentFactory();
	};

	return runWithProxyPool(label, warmFactory, payload, provider, fetchProxies);
	});
}
