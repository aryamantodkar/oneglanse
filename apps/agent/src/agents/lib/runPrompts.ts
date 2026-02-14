import { Page } from "playwright";
import { askPrompt } from "./steps/askPrompt.js";
import { fetchPromptResponses } from "./steps/fetchPromptResponses.js";
import { checkAndExtractSources } from "./steps/extractSources.js";
import { Provider, AskPromptResult, Source } from "@onescope/types";
import { logger } from "../../lib/utils/logger.js";
import { PromptPayload } from "@onescope/types";
import { IPRefreshNeededError } from "@onescope/errors";

const MAX_PROMPT_RETRIES = Number(process.env.MAX_PROMPT_RETRIES_PER_IP ?? 3);
const INITIAL_RETRY_DELAY = Number(process.env.PROMPT_RETRY_DELAY_MS ?? 1000);
const MAX_RETRY_DELAY = Number(process.env.MAX_PROMPT_RETRY_DELAY_MS ?? 5000);

function getExponentialBackoffDelay(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 2);
  return Math.min(delay, MAX_RETRY_DELAY);
}

function classifyFailureType(err: any): string | undefined {
  const msg = String(err?.message ?? "").toLowerCase();
  if (/err_proxy|err_connection|err_ssl|err_timed_out/i.test(msg)) return "connection_error";
  if (/bot.?detect|cloudflare|captcha|turnstile/i.test(msg)) return "bot_detection";
  if (/rate.?limit|too many|usage.?limit/i.test(msg)) return "rate_limited";
  if (/extraction.*fail|empty.*response/i.test(msg)) return "extraction_failed";
  if (/send failed|no send button|no generation/i.test(msg)) return "no_editor";
  if (/typing failed/i.test(msg)) return "no_editor";
  return undefined;
}

export async function runPrompts(payload: PromptPayload, page: Page, provider: Provider): Promise<AskPromptResult[]> {
    logger.debug("🤖 Running prompts...\n");
    const { user_id: userId, workspace_id: workspaceId, prompts: promptsArray } = payload;

    await page
      .waitForLoadState("domcontentloaded", { timeout: 30000 })
      .catch(() => {});

    let promptMetrics: AskPromptResult[] = [];
    let totalFailedCount = 0;

    // Canary flag: first successful prompt proves this proxy works
    let proxyProven = false;

    for (let i = 0; i < promptsArray.length; i++) {
      const promptEntry = promptsArray[i];
      if (!promptEntry) {
        logger.error(`Prompt at index ${i} is undefined.`);
        continue;
      }
      const promptId = promptEntry.id;
      const prompt = promptEntry.prompt;

      logger.debug(`\n${"=".repeat(70)}`);
      logger.debug(`Prompt ${i + 1}/${promptsArray.length}`);
      logger.debug(`${"=".repeat(70)}`);
      logger.debug(`📝 ${prompt}\n`);

      // Canary: first prompt on unproven proxy gets 1 attempt (fail fast)
      // Proven proxy gets full retries (it's earned trust)
      const effectiveMaxRetries = proxyProven ? MAX_PROMPT_RETRIES : 1;

      let lastError: any = null;

      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const backoffDelay = getExponentialBackoffDelay(attempt);
            logger.log(`🔄 Retry attempt ${attempt}/${effectiveMaxRetries} for prompt ${i + 1} (waiting ${backoffDelay / 1000}s)`);
            await page.waitForTimeout(backoffDelay);
          }

          await askPrompt(page, prompt, provider);

          await page.waitForTimeout(1500);

          let response: string = await fetchPromptResponses(page, provider);
          if (!response || response.trim().length === 0) {
            throw new Error(`[${provider}] Empty response extracted; blocking source extraction and retrying prompt`);
          }

          await page.waitForTimeout(1500);

          let sources: Source[] = await checkAndExtractSources(page, provider);

          await page.waitForTimeout(1500);

          logger.success(`✓ Prompt ${i + 1}/${promptsArray.length} completed${attempt > 1 ? ` (succeeded on retry ${attempt})` : ""}`);

          promptMetrics.push({
            userId,
            workspaceId,
            promptId,
            prompt,
            response,
            sources
          });

          // First success proves this proxy works — unlock full retries for remaining prompts
          if (!proxyProven) {
            proxyProven = true;
            logger.log(`✅ Proxy proven good after canary prompt — full retries enabled for remaining prompts`);
          }

          break;
        } catch (err: any) {
          lastError = err;
          logger.error(`❌ Attempt ${attempt}/${effectiveMaxRetries} failed for prompt ${i + 1}: [${provider}] ${err.message}`);

          // Canary failed: immediately rotate IP without retrying
          if (!proxyProven) {
            logger.warn(`⚡ Canary prompt failed on unproven proxy — rotating IP immediately`);
            const remainingPrompts = promptsArray.slice(i);
            throw new IPRefreshNeededError(
              `${provider} canary prompt failed — rotating IP. Error: ${lastError?.message}`,
              promptMetrics,
              remainingPrompts,
              i,
              classifyFailureType(lastError)
            );
          }

          const isExtractionFailure = /Markdown response extraction failed|Empty response extracted/i.test(
            String(err?.message ?? "")
          );
          if (isExtractionFailure) {
            logger.warn(`⚠️ Repeated extraction failure on current IP (prompt ${i + 1}, attempt ${attempt}/${effectiveMaxRetries})`);
          }

          if (attempt === effectiveMaxRetries) {
            totalFailedCount++;
            logger.error(`🔴 Prompt ${i + 1} failed after ${effectiveMaxRetries} attempts. Final error: ${lastError?.message}`);
            logger.error(`🔴 Triggering IP refresh for remaining prompts.`);

            const remainingPrompts = promptsArray.slice(i);

            throw new IPRefreshNeededError(
              `${provider} failed ${effectiveMaxRetries} consecutive attempts — refreshing IP. Last error: ${lastError?.message}`,
              promptMetrics,
              remainingPrompts,
              i,
              classifyFailureType(lastError)
            );
          }
        }
      }
    }

    const successCount = promptMetrics.length;
    const totalCount = promptsArray.length;

    if (totalFailedCount > 0) {
      logger.warn(`⚠️ Completed with errors: ${successCount}/${totalCount} prompts succeeded, ${totalFailedCount} failed`);
    } else {
      logger.success(`✅ All prompts completed successfully (${successCount}/${totalCount})`);
    }

    return promptMetrics;
  }
