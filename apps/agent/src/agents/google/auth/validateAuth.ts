import { Page } from "playwright";
import { pageHealthCheck } from "../../../lib/browser/pageHealthCheck.js";
import { logger } from "../../../lib/utils/logger.js";
import path from "path";
import fs from "fs";

export async function isGoogleAuthenticated(page: Page, skipHealthCheck: boolean = false): Promise<boolean> {
    // Check if on a Google domain
    if (!page.url().includes("google.com")) return false;

    // Wait for the page to be interactive
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Check for authentication indicators
    let isAuthenticated = false;

    for (let i = 0; i < 3; i++) {
      isAuthenticated = await page.evaluate(() => {
        // Check for "Sign in" button (logged out state)
        const signInButton = document.querySelector(
          'a[href*="accounts.google.com/ServiceLogin"]'
        );
        if (signInButton) {
          return false; // User is logged out
        }

        // Check for account button with email/user info (MOST RELIABLE INDICATOR)
        // This appears when user is logged in
        const accountButton = document.querySelector(
          'a[role="button"][aria-label*="Google Account"]'
        );
        if (accountButton) {
          return true; // User is logged in
        }

        // Fallback: Check for any element with email pattern
        const emailMeta = document.querySelector('meta[name="og-profile-acct"]');
        if (emailMeta?.getAttribute('content')) {
          return true;
        }

        return false;
      });

      if (isAuthenticated !== undefined) break;

      // Wait before retrying
      await page.waitForTimeout(2000);
    }

    // Skip health check during local auth flow
    if (skipHealthCheck) {
      return isAuthenticated;
    }

    const health = await pageHealthCheck(page, "google");

    // Take screenshot if authentication fails
    if (!health.healthy) {
      try {
        const screenshotDir = path.resolve(process.env.VPS_AUTH_PROFILE_PATH || "/storage", "debug-screenshots");
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const screenshotPath = path.join(screenshotDir, `google-auth-failed-${timestamp}.png`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.warn(`🐛 Screenshot saved: ${screenshotPath}`);
        logger.warn(`🐛 Health check failed - reason: ${health.reason}, failureType: ${health.failureType}`);

        // Also log page content snippet for quick debugging
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
        logger.warn(`🐛 Page text snippet: ${bodyText.slice(0, 200)}`);
      } catch (err) {
        logger.error(`Failed to capture debug screenshot: ${err}`);
      }
    }

    return health.healthy;
  }