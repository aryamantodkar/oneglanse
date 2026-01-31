import { launchContext } from "../../lib/browser/launchContext.js";
import { logger } from "../../lib/utils/logger.js";
import fs from "fs";
import path from "path";

export async function launchAnthropic() {
    const { browser, context } = await launchContext("anthropic");
    const page = await context.newPage();

    // --- DEBUG: Log loaded cookies ---
    const cookies = await context.cookies();
    const claudeCookies = cookies.filter(c => c.domain.includes("claude.ai"));
    logger.log(`🔍 DEBUG: Total cookies loaded: ${cookies.length}`);
    logger.log(`🔍 DEBUG: Claude.ai cookies: ${claudeCookies.length}`);
    for (const c of claudeCookies) {
      const expired = c.expires > 0 && c.expires < Date.now() / 1000;
      logger.log(`🔍   cookie: ${c.name} | domain: ${c.domain} | secure: ${c.secure} | httpOnly: ${c.httpOnly} | expired: ${expired} | expires: ${new Date(c.expires * 1000).toISOString()}`);
    }

    // --- DEBUG: Listen to console and network errors ---
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        logger.log(`🔍 DEBUG console.error: ${msg.text()}`);
      }
    });
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) {
        logger.log(`🔍 DEBUG HTTP ${status}: ${response.url()}`);
      }
    });

    const ipInfo = await page.evaluate(async () => {
        const res = await fetch("https://api.ipify.org?format=json", {
            cache: "no-store",
        });
        return res.json();
    });
    logger.log("🌐 Runtime IP:", ipInfo);

    // Navigate to /new directly — /login serves the marketing page to headless browsers
    logger.log("📍 Navigating to https://claude.ai/new");
    const response = await page.goto('https://claude.ai/new', { waitUntil: "networkidle", timeout: 60000 });
    logger.log(`🔍 DEBUG: Response status: ${response?.status()}`);
    logger.log(`🔍 DEBUG: URL after navigation: ${page.url()}`);

    // If we got redirected to login, the session is invalid
    if (page.url().includes('/login')) {
      logger.log(`🔍 DEBUG: Redirected to login — session invalid`);
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || "empty");
      logger.log(`🔍 DEBUG: Page body: ${bodyText}`);
    }

    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}