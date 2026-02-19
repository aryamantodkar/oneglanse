import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchAiOverview() {
  const { browser, context, proxy } = await launchContext("google-ai-overview");
  const page = await context.newPage();

  // Visit Gemini first to activate the Google session — the saved auth state comes from
  // gemini.google.com, and www.google.com needs a live cross-domain handshake to
  // receive its own auth cookies (login_info, SIDCC, etc). Without this step,
  // loading google.com fresh from the stored state shows "Sign in".
  logger.log("📍 Activating session via https://gemini.google.com/");
  await navigateWithRetry(page, 'https://gemini.google.com/', { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  logger.log("📍 Navigating to https://www.google.com");
  await navigateWithRetry(page, 'https://www.google.com', {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  const url = page.url();
  logger.log('AI Overview loaded:', url);

  return { browser, context, page, proxy };
}
