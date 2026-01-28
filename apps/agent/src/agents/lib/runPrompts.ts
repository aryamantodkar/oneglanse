import { Page } from "playwright";
import { askPrompt } from "./steps/askPrompt.js";
import { fetchPromptResponses } from "./steps/fetchPromptResponses.js";
import { checkAndExtractSources } from "./steps/extractSources.js";
import { Provider, AskPromptResult, Source } from "@onescope/types";
import { logger } from "../../lib/utils/logger.js";
import { PromptPayload } from "@onescope/types";

export async function runPrompts(payload: PromptPayload, page: Page, provider: Provider): Promise<AskPromptResult[]> {
    logger.debug("🤖 Running prompts...\n");
    const { user_id: userId, workspace_id: workspaceId, prompts: promptsArray } = payload;

    await page
      .waitForLoadState("domcontentloaded", { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(2000);
  
    let promptMetrics: AskPromptResult[] = [];
    
    for (let i = 0; i < promptsArray.length; i++) {
      const promptId = promptsArray[i].id;
      const prompt = promptsArray[i].prompt;
  
      logger.debug(`\n${"=".repeat(70)}`);
      logger.debug(`Prompt ${i + 1}/${promptsArray.length}`);
      logger.debug(`${"=".repeat(70)}`);
      logger.debug(`📝 ${prompt}\n`);
  
      try {
        await askPrompt(page, prompt, provider);

        await page.waitForTimeout(1500);

        let response: string = await fetchPromptResponses(page, provider);

        await page.waitForTimeout(1500);

        let sources: Source[] = await checkAndExtractSources(page, provider);

        await page.waitForTimeout(1500);
  
        logger.success(`Saved result ${i + 1}`);
  
        promptMetrics.push({
          userId,
          workspaceId,
          promptId,
          prompt,
          response,
          sources
        });
      } catch (err: any) {
        logger.error(`Error processing prompt ${i + 1}: ${err.message}`);
        
        promptMetrics.push({
          userId,
          workspaceId,
          promptId,
          prompt,
          response: "",
          sources: []
        });
      }
    }
  
    logger.success("All prompts completed.");
  
    return promptMetrics;
  }