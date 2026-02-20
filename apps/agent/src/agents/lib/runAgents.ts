import type { AskPromptResult, PromptPayload, Provider } from "@onescope/types";
import type { Page } from "playwright";
import { warmUpEditor } from "../../lib/input/warmUpEditor.js";
import { runStep } from "../../lib/utils/runStep.js";
import { runPrompts } from "./runPrompts.js";

export async function runAgents(
	prompts: PromptPayload,
	page: Page,
	provider: Provider,
): Promise<AskPromptResult[]> {
	await page.waitForTimeout(3000);

	await runStep(`Warming up ${provider}`, page, async () => {
		await warmUpEditor(page);
	});

	return await runPrompts(prompts, page, provider);
}
