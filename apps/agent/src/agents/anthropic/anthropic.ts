import { launchContext } from "../../lib/browser/launchContext.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchAnthropic() {
    const { browser, context } = await launchContext("anthropic");
    let page = null;
    
    page = await context.newPage();
    
    logger.log("📍 Navigating to https://claude.ai/login");

    await page.goto('https://claude.ai/login', { waitUntil: "domcontentloaded" });
    
    await page.waitForTimeout(5000);
    
    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}