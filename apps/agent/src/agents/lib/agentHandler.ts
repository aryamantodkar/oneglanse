import { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";
import { UserPrompt, Provider, AskPromptResult, PromptPayload } from "@onescope/types";

export async function agentHandler<T>(
    label: string,
    agentFactory: () => Promise<{
      browser: Browser;
      context: BrowserContext;
      page: Page;
      auth: boolean;
    }>,
    payload: PromptPayload,
    provider: Provider
  ): Promise<AskPromptResult[]> {
    const { browser, context, page, auth } = await agentFactory();
  
    logger.log(`${label} authentication status: ${auth}`);
  
    try {
      if (!auth) return [];
      return await runAgents(payload, page, provider);
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});

      logger.debug(`${label} browser instance closed successfully.`)
    }
}