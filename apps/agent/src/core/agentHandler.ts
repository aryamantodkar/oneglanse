import type {
	AskPromptResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import {
	type AgentFactory,
	type AttemptExecutor,
	runWithRetryCycles,
} from "../lib/browser/proxy/runner.js";
import { runWithProvider } from "../lib/providerContext.js";

export async function agentHandler(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
	options?: {
		executor?: AttemptExecutor;
	},
): Promise<AskPromptResult[]> {
	return runWithProvider(provider, async () => {
		return runWithRetryCycles(label, agentFactory, payload, provider, {
			executor: options?.executor,
		});
	});
}
