import { launchContext } from "../../lib/browser/launchContext.js";
import { logger } from "../../lib/utils/logger.js";

export async function launchAnthropic() {
    const { browser, context } = await launchContext("anthropic");
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

    await page.goto('https://claude.ai/login', { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for redirect away from /login (up to 15s), or timeout if session is invalid
    try {
      await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
    } catch {
      // Still on /login after 15s — session is likely invalid
    }

    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}