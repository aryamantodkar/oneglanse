import fs from "node:fs";
import path from "node:path";
import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { pageHealthCheck } from "../../../../lib/browser/pageHealthCheck.js";
import { logger } from "../../../../lib/utils/logger.js";

export async function isGoogleAuthenticated(
	page: Page,
	skipHealthCheck = false,
	provider: Provider = "google",
): Promise<boolean> {
	// Check if on a Google domain
	if (!page.url().includes("google.com")) return false;

	// Wait for the page to be interactive
	await page
		.waitForLoadState("networkidle", { timeout: 10000 })
		.catch(() => {});

	// Check for authentication indicators
	let isAuthenticated = false;

	for (let i = 0; i < 3; i++) {
		isAuthenticated = await page.evaluate(() => {
			// Check for "Sign in" button (logged out state)
			const signInButton = document.querySelector(
				'a[href*="accounts.google.com/ServiceLogin"]',
			);
			if (signInButton) {
				return false; // User is logged out
			}

			// Check for account button with email/user info (MOST RELIABLE INDICATOR)
			// This appears when user is logged in
			const accountButton = document.querySelector(
				'a[role="button"][aria-label*="Google Account"]',
			);
			if (accountButton) {
				return true; // User is logged in
			}

			// Fallback: Check for any element with email pattern
			const emailMeta = document.querySelector('meta[name="og-profile-acct"]');
			if (emailMeta?.getAttribute("content")) {
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

	const health = await pageHealthCheck(page, provider);

	return health.healthy;
}
