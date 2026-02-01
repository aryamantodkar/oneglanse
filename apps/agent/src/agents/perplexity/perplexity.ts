import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchPerplexity() {
    const { browser, context } = await launchContext("perplexity");

    let page = null;

    page = await context.newPage();

    logger.log("📍 Navigating to https://www.perplexity.ai");

    await navigateWithRetry(page, "https://www.perplexity.ai", { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForTimeout(5000);
    
    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}