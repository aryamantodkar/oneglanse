import { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "./runAgents.js";
import { logger } from "../../lib/utils/logger.js";
import { Provider, AskPromptResult, PromptPayload } from "@onescope/types";
import { recordProxyResult, fetchProxies } from "../../lib/browser/proxyPool.js";
import type { FailureType } from "../../lib/browser/pageHealthCheck.js";
import { AuthError, IPRefreshNeededError } from "@onescope/errors";

const PROVIDER_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const PROXIES_PER_CYCLE = 5; // More proxies per cycle since health checks fail fast
const MAX_CYCLES = 10; // Fewer cycles needed with fast-fail
const INITIAL_BACKOFF = 5_000; // 5 seconds — shorter since bad proxies are caught quickly
const MAX_CYCLE_BACKOFF = 60_000; // Cap cycle backoff at 60s
const RETRY_DELAY = 2000; // 2 seconds between proxy attempts

function getCycleBackoffMs(cycle: number): number {
  if (cycle <= 0) return 0;
  return Math.min(INITIAL_BACKOFF * Math.pow(2, cycle - 1), MAX_CYCLE_BACKOFF);
}

function classifyError(err: any): FailureType {
  const msg = String(err?.message ?? "").toLowerCase();
  if (/err_proxy|err_connection|err_ssl|err_timed_out/i.test(msg)) return "connection_error";
  if (/bot.?detect|cloudflare|captcha|turnstile|challenge/i.test(msg)) return "bot_detection";
  if (/logged.?out|login|auth.*missing|session.*invalid|authentication is false/i.test(msg)) return "logged_out";
  if (/rate.?limit|too many|usage.?limit/i.test(msg)) return "rate_limited";
  if (/no.*editor|editor.*not.*ready|no_editor/i.test(msg)) return "no_editor";
  if (/extraction.*fail|empty.*response/i.test(msg)) return "extraction_failed";
  if (/timed?\s*out/i.test(msg)) return "timeout";
  return "unknown";
}

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

    let accumulatedResults: AskPromptResult[] = [];
    let currentPayload = payload;

    try {
      await fetchProxies({ resetBadProxies: true });
      logger.log(`${label} initialized proxy pool`);
    } catch (err: any) {
      logger.error(`${label} failed to initialize proxy pool:`, err?.message);
    }

    for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
      if (cycle > 0) {
        const backoff = getCycleBackoffMs(cycle);
        logger.warn(`${label} cycle ${cycle + 1}/${MAX_CYCLES}: backing off ${backoff / 1000}s, refreshing proxies...`);
        await new Promise((r) => setTimeout(r, backoff));

        try {
          await fetchProxies({ forceRefresh: true });
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
                  throw new Error(`${provider} authentication is false or using invalid proxy.`);
                }

                return await runAgents(currentPayload, agent.page, provider);
              })(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out after ${PROVIDER_TIMEOUT / 1000}s`)), PROVIDER_TIMEOUT)
              ),
            ]);

            // Success — record good proxy and return results
          accumulatedResults.push(...result);
          if (refs.proxy) {
            recordProxyResult(refs.proxy, true, undefined, provider);
          }
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

            // Record proxy failure with specific failure type for scoring
            if (refs.proxy) {
              const failureType = (err.failureType as FailureType) ?? classifyError(err);
              recordProxyResult(refs.proxy, false, failureType, provider);
            }

            // Continue to next attempt (new IP)
            if (attempt < PROXIES_PER_CYCLE - 1) {
              await new Promise((r) => setTimeout(r, RETRY_DELAY));
            }
            continue;
          }

          // Regular error — classify and record for proxy scoring
          const failureType = classifyError(err);
          logger.error(`${label} failed (attempt ${totalAttempt}/${totalMax}, cycle ${cycle + 1}/${MAX_CYCLES}, type=${failureType}):`, err?.message ?? err);

          if (refs.proxy) {
            recordProxyResult(refs.proxy, false, failureType, provider);
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
}
