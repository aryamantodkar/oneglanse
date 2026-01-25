import { Page } from "playwright";
import { askPrompt } from "./steps/askPrompt.js";
import { fetchPromptResponses } from "./steps/fetchPromptResponses.js";
import { checkAndExtractSources } from "./steps/extractSources.js";
import { UserPrompt, Provider, AskPromptResult, Source } from "../../types/types.js";
import { logger } from "../../lib/utils/logger.js";

export async function runPrompts(prompts: UserPrompt[], page: Page, provider: Provider): Promise<AskPromptResult[]> {
    logger.debug("🤖 Running prompts...\n");

    await page
      .waitForLoadState("domcontentloaded", { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(2000);
  
    let promptMetrics: AskPromptResult[] = [];
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
  
      logger.debug(`\n${"=".repeat(70)}`);
      logger.debug(`Prompt ${i + 1}/${prompts.length}`);
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
          promptId: prompt.id,
          prompt: prompt.prompt,
          response,
          sources
        });
      } catch (err: any) {
        logger.error(`Error processing prompt ${i + 1}: ${err.message}`);
        
        promptMetrics.push({
          promptId: prompt.id,
          prompt: prompt.prompt,
          response: "",
          sources: []
        });
      }
    }
  
    logger.success("All prompts completed.");
  
    return promptMetrics;
  }