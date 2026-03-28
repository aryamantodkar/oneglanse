import type {
	AskPromptResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import { navigateWithRetry } from "../lib/browser/navigate.js";
import {
	type AgentFactory,
	type AttemptExecutor,
	runWithRetryCycles,
} from "../lib/browser/proxy/runner.js";
import { getWarmBrowser } from "../lib/browser/warmPool.js";
import { runWithProvider } from "../lib/providerContext.js";
import { PROVIDER_CONFIGS } from "./providers/index.js";

export async function agentHandler(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
	options?: {
		executor?: AttemptExecutor;
		sessionKey?: string;
	},
): Promise<AskPromptResult[]> {
	return runWithProvider(provider, async () => {
		const warmFactory: AgentFactory = async () => {
			if (options?.sessionKey) {
				const warm = await getWarmBrowser(provider, options.sessionKey).catch(
					() => null,
				);
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
							invalidateProxyHint: warm.invalidateProxyHint ?? undefined,
						};
					} catch {
						// Navigation on warm browser failed — close and fall through to cold factory.
						await warm.cleanup?.().catch(() => {});
						await warm.context?.close().catch(() => {});
						await warm.browser?.close().catch(() => {});
					}
				}
			}

			return agentFactory();
		};

		return runWithRetryCycles(label, warmFactory, payload, provider, {
			executor: options?.executor,
			sessionKey: options?.sessionKey,
		});
	});
}
