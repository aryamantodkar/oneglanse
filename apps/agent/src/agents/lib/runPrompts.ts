import { Page } from "playwright";
import { askPrompt } from "./steps/askPrompt.js";
import { fetchPromptResponses } from "./steps/fetchPromptResponses.js";
import { checkAndExtractSources } from "./steps/extractSources.js";
import { Provider, AskPromptResult, Source } from "@onescope/types";
import { logger } from "../../lib/utils/logger.js";
import { PromptPayload } from "@onescope/types";

const MAX_PROMPT_RETRIES = 7; // Increased from 3 to 7 for better resilience
const INITIAL_RETRY_DELAY = 2000; // 2 seconds for first retry
const MAX_RETRY_DELAY = 30000; // Cap at 30 seconds

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (1-indexed)
 * @returns Delay in milliseconds
 */
function getExponentialBackoffDelay(attempt: number): number {
  // Formula: initialDelay * (2 ^ (attempt - 2))
  // Attempt 2: 2s, Attempt 3: 4s, Attempt 4: 8s, Attempt 5: 16s, Attempt 6: 32s (capped at 30s), Attempt 7: 30s
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 2);
  return Math.min(delay, MAX_RETRY_DELAY);
}

export async function runPrompts(payload: PromptPayload, page: Page, provider: Provider): Promise<AskPromptResult[]> {
    logger.debug("🤖 Running prompts...\n");
    const { user_id: userId, workspace_id: workspaceId, prompts: promptsArray } = payload;

    await page
      .waitForLoadState("domcontentloaded", { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    let promptMetrics: AskPromptResult[] = [];
    let totalFailedCount = 0;

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

      let succeeded = false;
      let lastError: any = null;

      // Retry loop with exponential backoff for individual prompt
      for (let attempt = 1; attempt <= MAX_PROMPT_RETRIES; attempt++) {
        try {
          if (attempt > 1) {
            const backoffDelay = getExponentialBackoffDelay(attempt);
            logger.log(`🔄 Retry attempt ${attempt}/${MAX_PROMPT_RETRIES} for prompt ${i + 1} (waiting ${backoffDelay / 1000}s)`);
            await page.waitForTimeout(backoffDelay);
          }

          await askPrompt(page, prompt, provider);

          await page.waitForTimeout(1500);

          let response: string = await fetchPromptResponses(page, provider);

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

          succeeded = true;
          break; // Success - exit retry loop
        } catch (err: any) {
          lastError = err;
          logger.error(`❌ Attempt ${attempt}/${MAX_PROMPT_RETRIES} failed for prompt ${i + 1}: [${provider}] ${err.message}`);

          if (attempt === MAX_PROMPT_RETRIES) {
            // Final attempt failed - log comprehensive error
            totalFailedCount++;
            logger.error(`🔴 Prompt ${i + 1} failed after ${MAX_PROMPT_RETRIES} attempts with exponential backoff. Final error: ${lastError?.message}`);
            logger.error(`🔴 This indicates a persistent issue - check authentication or provider availability.`);
          }
          // Continue to next retry attempt
        }
      }
    }

    const successCount = promptMetrics.length;
    const totalCount = promptsArray.length;

    if (totalFailedCount > 0) {
      logger.warn(`⚠️ Completed with errors: ${successCount}/${totalCount} prompts succeeded, ${totalFailedCount} failed after ${MAX_PROMPT_RETRIES} retries with exponential backoff`);
      logger.warn(`⚠️ Total backoff time per failed prompt: up to ${(INITIAL_RETRY_DELAY * (Math.pow(2, MAX_PROMPT_RETRIES - 1) - 1)) / 1000}s`);
    } else {
      logger.success(`✅ All prompts completed successfully (${successCount}/${totalCount})`);
    }

    return promptMetrics;
  }