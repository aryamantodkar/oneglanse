import { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";
import { Provider, AskPromptResult, PromptPayload } from "@onescope/types";
import { markProxyBad, fetchProxies } from "../../lib/browser/proxyPool.js";

const PROVIDER_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const PROXIES_PER_CYCLE = 5;
const MAX_CYCLES = 10;
const INITIAL_BACKOFF = 10_000; // 10 seconds
const RETRY_DELAY = 3000; // 3 seconds

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

    for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
      if (cycle > 0) {
        const backoff = INITIAL_BACKOFF * Math.pow(2, cycle - 1);
        logger.warn(`${label} cycle ${cycle + 1}/${MAX_CYCLES}: backing off ${backoff / 1000}s, refreshing proxies...`);
        await new Promise((r) => setTimeout(r, backoff));

        try {
          await fetchProxies();
        } catch (err: any) {
          logger.error(`${label} failed to refresh proxies:`, err?.message);
        }
      }

      for (let attempt = 0; attempt < PROXIES_PER_CYCLE; attempt++) {
        const totalAttempt = cycle * PROXIES_PER_CYCLE + attempt + 1;
        const totalMax = MAX_CYCLES * PROXIES_PER_CYCLE;

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

              if (!agent.auth) {
                throw new Error(`${label} authentication failed`);
              }

              return await runAgents(payload, agent.page, provider);
            })(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`${label} timed out after ${PROVIDER_TIMEOUT / 1000}s`)), PROVIDER_TIMEOUT)
            ),
          ]);

          return result;
        } catch (err: any) {
          logger.error(`${label} failed (attempt ${totalAttempt}/${totalMax}, cycle ${cycle + 1}/${MAX_CYCLES}):`, err?.message ?? err);

          if (refs.proxy) {
            markProxyBad(refs.proxy);
          }

          if (attempt < PROXIES_PER_CYCLE - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
          }
        } finally {
          await refs.context?.close().catch(() => {});
          await refs.browser?.close().catch(() => {});
          logger.debug(`${label} browser instance closed successfully.`);
        }
      }
    }

    logger.error(`${label} failed after ${MAX_CYCLES * PROXIES_PER_CYCLE} attempts across ${MAX_CYCLES} cycles`);
    return [];
}
