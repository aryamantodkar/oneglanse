import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchPerplexity() {
    const { browser, context, proxy } = await launchContext("perplexity");

    let page = null;

    page = await context.newPage();

    logger.log("📍 Navigating to https://www.perplexity.ai");

    await navigateWithRetry(page, "https://www.perplexity.ai", { waitUntil: "domcontentloaded", timeout: 60000 });

    // Random delay to appear more human-like (5-8 seconds)
    const randomDelay = 5000 + Math.floor(Math.random() * 3000);
    await page.waitForTimeout(randomDelay);

    // Simulate human activity - scroll a bit
    await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 200);
    }).catch(() => {});

    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page, proxy };
}
