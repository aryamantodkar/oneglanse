import { Page } from "playwright";
import { runPrompts } from "./runPrompts.js";
import { warmUpEditor } from "../../lib/input/warmUpEditor.js";
import { runStep } from "../../lib/utils/runStep.js";
import { UserPrompt, Provider, AskPromptResult } from "../../types/types.js";
import { ensureNewChat } from "../openai/lib/newChat.js";

export async function runAgents(prompts: UserPrompt[], page: Page, provider: Provider): Promise<AskPromptResult[]> {
    if(provider=="openai"){
      await runStep("Ensuring new chat is created.", page, async () => {
        await ensureNewChat(page);
      });
    }
  
    await runStep(`Warming up ${provider}`, page, async () => {
      await warmUpEditor(page);
    });

    return await runPrompts(prompts, page, provider);
}
  