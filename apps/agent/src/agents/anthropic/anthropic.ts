import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchAnthropic() {
    const { browser, context } = await launchContext("anthropic");
    const page = await context.newPage();

    logger.log("📍 Navigating to https://claude.ai/new");
    await navigateWithRetry(page, 'https://claude.ai/new', { waitUntil: "domcontentloaded", timeout: 60000 });

    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}