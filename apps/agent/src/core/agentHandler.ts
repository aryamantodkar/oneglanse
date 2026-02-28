import { toErrorMessage } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import type { AskPromptResult, PromptPayload, Provider } from "@oneglanse/types";
import { fetchProxies } from "../lib/browser/proxy/pool.js";
import { type AgentFactory, runWithProxyPool } from "../lib/browser/proxy/runner.js";

export async function agentHandler(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
): Promise<AskPromptResult[]> {
	try {
		await fetchProxies({ resetBadProxies: true });
		logger.log(`${label} initialized proxy pool`);
	} catch (err) {
		logger.error(`${label} failed to initialize proxy pool:`, toErrorMessage(err));
	}

	return runWithProxyPool(label, agentFactory, payload, provider, fetchProxies);
}
