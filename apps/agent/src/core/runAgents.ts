import type {
	AskPromptResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import type { Page } from "playwright";
import { runPrompts } from "./prompt-runner/index.js";

export async function runAgents(
	prompts: PromptPayload,
	page: Page,
	provider: Provider,
): Promise<AskPromptResult[]> {
	return runPrompts(prompts, page, provider);
}
