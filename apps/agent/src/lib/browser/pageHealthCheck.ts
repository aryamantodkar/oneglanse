import { Page } from "playwright";
import { Provider } from "@onescope/types";
import { logger } from "../utils/logger.js";
import { EDITOR_SELECTORS } from "@onescope/utils";

export type FailureType =
  | "connection_error"
  | "bot_detection"
  | "logged_out"
  | "rate_limited"
  | "no_editor"
  | "extraction_failed"
  | "timeout"
  | "unknown";

export type HealthCheckResult = {
  healthy: boolean;
  reason?: string;
  failureType?: FailureType;
};

export async function pageHealthCheck(
  page: Page,
  provider: Provider
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // 1. Bot detection / Cloudflare challenge (~1s)
    const botDetection = await page.evaluate(() => {
      const body = document.body?.innerText?.toLowerCase() ?? "";
      const title = document.title?.toLowerCase() ?? "";

      if (title.includes("just a moment") || body.includes("checking your browser"))
        return "cloudflare";
      if (
        document.querySelector('iframe[src*="captcha"]') ||
        document.querySelector('[class*="captcha" i]') ||
        document.querySelector("#challenge-form")
      )
        return "captcha";
      if (document.querySelector('iframe[src*="turnstile"]')) return "turnstile";

      return null;
    }).catch(() => null);

    if (botDetection) {
      logger.warn(`[${provider}] Health check: bot detection (${botDetection}) in ${Date.now() - start}ms`);
      return { healthy: false, reason: `bot_detection:${botDetection}`, failureType: "bot_detection" };
    }

    // 2. Login/signup form visible (~0.5s)
    const loginVisible = await page.evaluate(() => {
      const body = document.body?.innerText ?? "";
      const hasPasswordField = !!document.querySelector('input[type="password"]');
      const hasLoginForm = !!document.querySelector(
        'form[action*="login"], form[action*="auth"], form[action*="signin"]'
      );
      const bodyStart = body.slice(0, 2000).toLowerCase();
      const hasLoginText =
        /sign in to|log in to|create.*account|sign up for/i.test(bodyStart);

      return hasPasswordField || hasLoginForm || hasLoginText;
    }).catch(() => false);

    if (loginVisible) {
      logger.warn(`[${provider}] Health check: login page detected in ${Date.now() - start}ms`);
      return { healthy: false, reason: "logged_out", failureType: "logged_out" };
    }

    // 3. Rate limit detection (~0.5s)
    const rateLimited = await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() ?? "";
      const snippet = text.slice(0, 3000);
      return /rate limit|too many requests|try again later|usage limit|you've reached/i.test(snippet);
    }).catch(() => false);

    if (rateLimited) {
      logger.warn(`[${provider}] Health check: rate limited in ${Date.now() - start}ms`);
      return { healthy: false, reason: "rate_limited", failureType: "rate_limited" };
    }

    // 4. Provider-specific editor presence (~2-3s)
    const selectors = EDITOR_SELECTORS;
    let editorFound = false;

    for (const selector of selectors) {
      try {
        await page
          .locator(selector)
          .first()
          .waitFor({ state: "visible", timeout: 8000 });
        editorFound = true;
        break;
      } catch {
        // Try next selector
      }
    }

    if (!editorFound) {
      logger.warn(`[${provider}] Health check: no editor found in ${Date.now() - start}ms`);
      return { healthy: false, reason: "no_editor", failureType: "no_editor" };
    }

    logger.debug(`[${provider}] Health check passed in ${Date.now() - start}ms`);
    return { healthy: true };
  } catch (err: any) {
    logger.warn(`[${provider}] Health check error: ${err?.message}`);
    return { healthy: false, reason: err?.message, failureType: "unknown" };
  }
}
