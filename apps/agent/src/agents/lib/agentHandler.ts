import { Browser, BrowserContext, Page } from "playwright";
import { UserPrompt, Provider, AskPromptResult } from "../../types/types.js";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";

export async function agentHandler<T>(
    label: string,
    agentFactory: () => Promise<{
      browser: Browser;
      context: BrowserContext;
      page: Page;
      auth: boolean;
    }>,
    prompts: UserPrompt[],
    provider: Provider
  ): Promise<AskPromptResult[]> {
    const { browser, context, page, auth } = await agentFactory();
  
    logger.log(`${label} authentication status: ${auth}`);
  
    try {
      if (!auth) return [];
      return await runAgents(prompts, page, provider);
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});

      logger.debug(`${label} browser instance closed successfully.`)
    }
}