import { Page } from "playwright";
import { getLastAssistantText, isGenerating } from "./getLastAssistantText.js";
import { Provider } from "@onescope/types";
import { logger } from "../utils/logger.js";

// Shared polling helper - DRY principle
async function pollUntilCondition(
  checkFn: () => Promise<boolean>,
  pollInterval: number,
  maxWait: number,
  timeoutError: string
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await checkFn()) return;
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  throw new Error(timeoutError);
}

export async function waitForAssistantToFinish(page: Page, provider: Provider): Promise<void> {
  logger.debug("⏳ Waiting for assistant to finish…");

  // Google AI Overview has different detection logic
  if (provider === "google-ai-overview") {
    const MIN_CONTENT = 300;
    const STABLE_MS = 2000;
    let lastLength = 0;
    let lastChange = Date.now();

    await pollUntilCondition(
      async () => {
        try {
          const { contentLength, isReady, hasError } = await page.evaluate((minContent) => {
            // Quick checks first (avoid expensive operations)
            const docReady = document.readyState === 'complete';
            const hasQuery = location.href.includes('?q=') || location.href.includes('&q=');

            // Check for ready signal
            const readySignal = Array.from(document.querySelectorAll('[aria-live]'))
              .some(el => (el.textContent || '').includes('response is ready'));

            // Check for errors
            const bodyLower = document.body.innerText.toLowerCase();
            const hasError = bodyLower.includes('error occurred') ||
                           bodyLower.includes('something went wrong');

            if (hasError) return { contentLength: 0, isReady: false, hasError: true };

            // Only scan for content if doc is ready and we have query in URL
            if (!docReady || !hasQuery) {
              return { contentLength: 0, isReady: false, hasError: false };
            }

            // Fast content check - use existing DOM structure instead of scanning all divs
            const mainContent = document.querySelector('main') || document.body;
            const contentDivs = mainContent.querySelectorAll('div');
            let maxLength = 0;

            for (const div of contentDivs) {
              const text = (div.innerText || '').trim();
              const childDivs = div.querySelectorAll('div').length;

              // Quick filters - skip obviously wrong elements
              if (text.length < minContent || text.length > 15000 || childDivs > 100) continue;
              if (text.includes('Sign in') || text.includes('Start a new thread')) continue;

              const role = div.getAttribute('role');
              if (role === 'navigation' || role === 'banner' || role === 'dialog') continue;

              if (text.length > maxLength) maxLength = text.length;
            }

            // Response is ready if: ready signal OR (has content + doc ready + not loading)
            const isLoading = bodyLower.includes('searching') ||
                            bodyLower.includes('loading') ||
                            document.querySelectorAll('[class*="loading"]').length > 0;

            const isReady = readySignal || (maxLength >= minContent && !isLoading);

            return { contentLength: maxLength, isReady, hasError: false };
          }, MIN_CONTENT);

          if (hasError) {
            throw new Error(`[${provider}] AI Mode returned an error`);
          }

          // Track stability
          if (contentLength !== lastLength) {
            lastLength = contentLength;
            lastChange = Date.now();
          }

          // Success: content ready + stable for 2s
          if (isReady && contentLength >= MIN_CONTENT) {
            const stableFor = Date.now() - lastChange;
            if (stableFor >= STABLE_MS) {
              logger.debug(`✅ AI Mode ready (${contentLength} chars, stable ${stableFor}ms)`);
              return true;
            }
          }

          return false;
        } catch (err: any) {
          if (err.message.includes(`[${provider}]`)) throw err;
          return false; // Continue on transient errors
        }
      },
      500, // Poll every 500ms
      90_000, // 90s max wait
      `[${provider}] Response wait timed out after 90s`
    );
    return;
  }

  // Chat providers (OpenAI, Anthropic, Perplexity, Google/Gemini)
  let lastText = "";
  let lastChange = Date.now();
  let seenOutput = false;

  await pollUntilCondition(
    async () => {
      const [generating, text] = await Promise.all([
        isGenerating(page),
        getLastAssistantText(page, provider)
      ]);

      // Track output
      if (text.length > 0) seenOutput = true;

      // Track changes
      if (text !== lastText) {
        lastText = text;
        lastChange = Date.now();
      }

      const stableFor = Date.now() - lastChange;
      const elapsed = Date.now() - lastChange;

      // Error: No output after 45s
      if (!seenOutput && elapsed >= 45_000) {
        throw new Error(`[${provider}] No response detected after 45s`);
      }

      // Still generating and no output yet - keep waiting
      if (generating && !seenOutput) return false;

      // Success: output seen + not generating + stable for 1.5s
      if (seenOutput && !generating && stableFor >= 1500) {
        logger.debug("✅ Assistant finished");
        return true;
      }

      // Force exit: stable for 15s (handles stuck generation indicators)
      if (seenOutput && stableFor >= 15_000) {
        logger.warn("Text stable 15s but still generating — forcing exit");
        return true;
      }

      return false;
    },
    300, // Poll every 300ms
    20 * 60 * 1000, // 20 min max
    `[${provider}] Assistant wait timed out`
  );
}
