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

    logger.log("📍 Navigating to https://claude.ai/login");
    const response = await page.goto('https://claude.ai/login', { waitUntil: "domcontentloaded", timeout: 30000 });
    logger.log(`🔍 DEBUG: Initial response status: ${response?.status()}`);
    logger.log(`🔍 DEBUG: URL after goto: ${page.url()}`);

    // Wait for redirect away from /login (up to 15s)
    try {
      await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
      logger.log(`🔍 DEBUG: Redirected to: ${page.url()}`);
    } catch {
      logger.log(`🔍 DEBUG: No redirect after 15s, still on: ${page.url()}`);

      // Dump page title and visible text for clues
      const title = await page.title();
      logger.log(`🔍 DEBUG: Page title: "${title}"`);

      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || "empty");
      logger.log(`🔍 DEBUG: Page body (first 500 chars): ${bodyText}`);
    }

    const url = page.url();
    logger.log('Logged in url:', url);

    return { browser, context, page };
}