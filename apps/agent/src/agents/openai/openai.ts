import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchOpenAI() {
    const { browser, context } = await launchContext("openai");

    let page = null;

    page = await context.newPage();

    logger.log("📍 Navigating to https://chatgpt.com/auth/login");

    await navigateWithRetry(page, 'https://chatgpt.com/auth/login', { waitUntil: "domcontentloaded", timeout: 60000 });
    
    await page.waitForTimeout(5000);
    
    const url = page.url();
    logger.log('Logged in url:', url);
    
    return { browser, context, page };
}