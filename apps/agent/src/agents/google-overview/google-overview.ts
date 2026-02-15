import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchGoogleOverview() {
  const { browser, context, proxy } = await launchContext("google-overview");
  const page = await context.newPage();

  logger.log("📍 Navigating to https://www.google.com/");
  await navigateWithRetry(page, 'https://www.google.com/', {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  const url = page.url();
  logger.log('Google Search loaded:', url);

  return { browser, context, page, proxy };
}
