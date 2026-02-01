import { Page } from "playwright";
import { runPrompts } from "./runPrompts.js";
import { warmUpEditor } from "../../lib/input/warmUpEditor.js";
import { runStep } from "../../lib/utils/runStep.js";
import { Provider, AskPromptResult, PromptPayload } from "@onescope/types";

export async function runAgents(prompts: PromptPayload, page: Page, provider: Provider): Promise<AskPromptResult[]> {
    page.waitForTimeout(3000);

    await runStep(`Warming up ${provider}`, page, async () => {
      await warmUpEditor(page);
    });

    return await runPrompts(prompts, page, provider);
}
  