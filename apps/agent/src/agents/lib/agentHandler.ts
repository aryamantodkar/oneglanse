import { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";
import { Provider, AskPromptResult, PromptPayload } from "@onescope/types";
import { markProxyBad, fetchProxies, clearProxyPool } from "../../lib/browser/proxyPool.js";
import { AuthError, IPRefreshNeededError } from "@onescope/errors";

const PROVIDER_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const PROXIES_PER_CYCLE = 3;
const MAX_CYCLES = 30; // More proxy refresh opportunities across all providers
const INITIAL_BACKOFF = 10_000; // 10 seconds
const MAX_CYCLE_BACKOFF = 60_000; // Cap cycle backoff at 60s
const RETRY_DELAY = 3000; // 3 seconds

function getCycleBackoffMs(cycle: number): number {
  if (cycle <= 0) return 0;
  return Math.min(INITIAL_BACKOFF * Math.pow(2, cycle - 1), MAX_CYCLE_BACKOFF);
}

export async function agentHandler(
    label: string,
    agentFactory: (options: { proxyPoolId: string }) => Promise<{
      browser: Browser;
      context: BrowserContext;
      page: Page;
      auth: boolean;
      proxy?: string | null;
    }>,
    payload: PromptPayload,
    provider: Provider
  ): Promise<AskPromptResult[]> {

    const proxyPoolId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let accumulatedResults: AskPromptResult[] = [];
    let currentPayload = payload;

    try {
      try {
        await fetchProxies(proxyPoolId, { resetBadProxies: true });
        logger.log(`${label} initialized proxy pool: ${proxyPoolId}`);
      } catch (err: any) {
        logger.error(`${label} failed to initialize proxy pool ${proxyPoolId}:`, err?.message);
      }

      for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
        if (cycle > 0) {
          const backoff = getCycleBackoffMs(cycle);
          logger.warn(`${label} cycle ${cycle + 1}/${MAX_CYCLES}: backing off ${backoff / 1000}s, refreshing proxies...`);
          await new Promise((r) => setTimeout(r, backoff));

          try {
            await fetchProxies(proxyPoolId, { forceRefresh: true });
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
                const agent = await agentFactory({ proxyPoolId });
                refs.browser = agent.browser;
                refs.context = agent.context;
                refs.proxy = agent.proxy ?? null;

                logger.log(`${label} authentication status: ${agent.auth}`);

                if (!agent.auth) {
                  throw new Error(`${provider} authentication is false or using invalid proxy.`);
                }

                return await runAgents(currentPayload, agent.page, provider);
              })(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out after ${PROVIDER_TIMEOUT / 1000}s`)), PROVIDER_TIMEOUT)
              ),
            ]);

            // Success - combine with accumulated results and return
            accumulatedResults.push(...result);
            return accumulatedResults;
          } catch (err: any) {
            if (err instanceof AuthError) {
              logger.error(`🔴 ${label} authentication is missing or invalid. Stopping retries.`);
              throw new Error(`${provider} not authenticated — re-login required. Run: pnpm --filter @onescope/agent run auth`);
            }

            // Check if this is an IP refresh request
            if (err instanceof IPRefreshNeededError) {
              logger.warn(`${label} needs IP refresh after failed attempts on prompt ${err.failedPromptIndex + 1}`);

              // Accumulate the partial results
              accumulatedResults.push(...err.partialResults);

              // Update payload to only include remaining prompts
              currentPayload = {
                ...currentPayload,
                prompts: err.remainingPrompts,
              };

              logger.log(`${label} saved ${err.partialResults.length} successful prompts, ${err.remainingPrompts.length} remaining`);

              // Mark proxy as bad and continue to next attempt with new IP
              if (refs.proxy) {
                markProxyBad(refs.proxy, proxyPoolId);
              }

              // Continue to next attempt (new IP)
              if (attempt < PROXIES_PER_CYCLE - 1) {
                await new Promise((r) => setTimeout(r, RETRY_DELAY));
              }
              continue;
            }

            // Regular error - log and mark proxy as bad
            logger.error(`${label} failed (attempt ${totalAttempt}/${totalMax}, cycle ${cycle + 1}/${MAX_CYCLES}):`, err?.message ?? err);

            if (refs.proxy) {
              markProxyBad(refs.proxy, proxyPoolId);
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

      const totalAttempts = MAX_CYCLES * PROXIES_PER_CYCLE;
      logger.error(`🔴 ${label} SESSION EXPIRED — failed all ${totalAttempts} attempts across ${MAX_CYCLES} cycles. Please re-login to ${provider}.`);
      throw new Error(`${provider} session expired — re-login required. Run: pnpm --filter @onescope/agent run auth`);
    } finally {
      clearProxyPool(proxyPoolId);
    }
}
