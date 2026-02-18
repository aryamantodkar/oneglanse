import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchAiOverview() {
  const { browser, context, proxy } = await launchContext("google-ai-overview");
  const page = await context.newPage();

  logger.log("📍 Navigating to https://www.google.com/search");
  await navigateWithRetry(page, 'https://www.google.com/search', {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  const url = page.url();
  logger.log('AI Overview loaded:', url);

  return { browser, context, page, proxy };
}
