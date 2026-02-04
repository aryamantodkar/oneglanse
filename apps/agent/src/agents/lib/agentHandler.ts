import { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";
import { Provider, AskPromptResult, PromptPayload } from "@onescope/types";
import { markProxyBad } from "../../lib/browser/proxyPool.js";

const PROVIDER_TIMEOUT = 8 * 60 * 1000; // 8 minutes
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

export async function agentHandler(
    label: string,
    agentFactory: () => Promise<{
      browser: Browser;
      context: BrowserContext;
      page: Page;
      auth: boolean;
      proxy?: string | null;
    }>,
    payload: PromptPayload,
    provider: Provider
  ): Promise<AskPromptResult[]> {

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const refs: { browser: Browser | null; context: BrowserContext | null; proxy: string | null } = {
        browser: null,
        context: null,
        proxy: null,
      };

      try {
        const result = await Promise.race([
          (async () => {
            const agent = await agentFactory();
            refs.browser = agent.browser;
            refs.context = agent.context;
            refs.proxy = agent.proxy ?? null;

            logger.log(`${label} authentication status: ${agent.auth}`);

            if (!agent.auth) return [];

            return await runAgents(payload, agent.page, provider);
          })(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${PROVIDER_TIMEOUT / 1000}s`)), PROVIDER_TIMEOUT)
          ),
        ]);

        return result;
      } catch (err: any) {
        logger.error(`${label} agent failed (attempt ${attempt}/${MAX_RETRIES}):`, err?.message ?? err);

        if (refs.proxy) {
          markProxyBad(refs.proxy);
        }

        if (attempt < MAX_RETRIES) {
          logger.warn(`Retrying ${label} in ${RETRY_DELAY / 1000}s...`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        }
      } finally {
        await refs.context?.close().catch(() => {});
        await refs.browser?.close().catch(() => {});
        logger.debug(`${label} browser instance closed successfully.`);
      }
    }

    logger.error(`${label} failed after ${MAX_RETRIES} attempts`);
    return [];
}
