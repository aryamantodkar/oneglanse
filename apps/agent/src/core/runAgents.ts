import type {
	AskPromptResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import type { Page } from "playwright";
import { warmUpEditor } from "../lib/input/editor/warmUp.js";
import { runStep } from "../lib/utils/runStep.js";
import { runPrompts } from "./prompt-runner/index.js";
import { PROVIDER_CONFIGS } from "./providers/index.js";

export async function runAgents(
	prompts: PromptPayload,
	page: Page,
	provider: Provider,
): Promise<AskPromptResult[]> {
	const config = PROVIDER_CONFIGS[provider];
	if (config.requiresWarmup) {
		// warmupDelayMs in createAgent already provides the post-navigation wait;
		// the extra delay here is redundant and adds unnecessary signal.
		await runStep(`Warming up ${provider}`, page, () =>
			warmUpEditor(page, provider),
		);
	}

	return runPrompts(prompts, page, provider);
}
