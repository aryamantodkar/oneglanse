import type { AskPromptResult, PromptPayload, Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { warmUpEditor } from "../lib/input/editor/warmUp.js";
import { runStep } from "../lib/utils/runStep.js";
import { runPrompts } from "./runPrompts.js";

async function runWarmUp(page: Page): Promise<void> {
	await warmUpEditor(page);
}

export async function runAgents(
	prompts: PromptPayload,
	page: Page,
	provider: Provider,
): Promise<AskPromptResult[]> {
	// google-ai-overview has no persistent chat UI; warmup makes no sense for it
	if (provider !== "google-ai-overview") {
		await page.waitForTimeout(3000);
		await runStep(`Warming up ${provider}`, page, () => runWarmUp(page));
	}

	return await runPrompts(prompts, page, provider);
}
