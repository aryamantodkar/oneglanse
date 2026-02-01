import { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";
import { Provider, AskPromptResult, PromptPayload } from "@onescope/types";

export async function agentHandler(
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
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;

    try {
      const agent = await agentFactory();
      browser = agent.browser;
      context = agent.context;

      logger.log(`${label} authentication status: ${agent.auth}`);

      if (!agent.auth) return [];
      
      return await runAgents(payload, agent.page, provider);
    } catch (err) {
      logger.error(`${label} agent failed:`, err);
      return [];
    } finally {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});

      logger.debug(`${label} browser instance closed successfully.`)
    }
}