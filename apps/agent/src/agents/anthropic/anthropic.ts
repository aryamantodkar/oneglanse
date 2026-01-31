import { launchContext } from "../../lib/browser/launchContext.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchAnthropic(sessionId: string) {
    const { browser, context } = await launchContext("anthropic", sessionId);
    let page = null;
    
    page = await context.newPage();

    const ipInfo = await page.evaluate(async () => {
        const res = await fetch("https://api.ipify.org?format=json", {
            cache: "no-store",
        });
        return res.json();
    });
    
    logger.log("🌐 Runtime IP:", ipInfo);
    
    logger.log("📍 Navigating to https://claude.ai/login");

    await page.goto('https://claude.ai/login', { waitUntil: "domcontentloaded" });
    
    await page.waitForTimeout(5000);
    
    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}