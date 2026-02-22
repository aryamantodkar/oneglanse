import fs from "node:fs";
import path from "node:path";
import type { Provider } from "@onescope/types";
import { PROVIDERS } from "@onescope/utils";
import { chromium } from "playwright-extra";
import { waitForAuthentication } from "../lib/auth/waitForAuthentication.js";
import { logger } from "../lib/utils/logger.js";
import { USER_DATA_DIR } from "./config.js";

export async function loginToProvider(provider: Provider): Promise<void> {
	const config = PROVIDERS[provider];
	const providerDir = path.join(USER_DATA_DIR, provider);
	const authFile = path.join(providerDir, `${provider}-auth.json`);

	if (!fs.existsSync(providerDir)) {
		fs.mkdirSync(providerDir, { recursive: true });
	}

	// Show clear instructions before browser launch
	logger.log(`\n${"=".repeat(70)}`);
	logger.log(`🔐 ${config.name.toUpperCase()} AUTHENTICATION`);
	logger.log(`${"=".repeat(70)}\n`);

	logger.log("📋 Instructions:");
	logger.log("   1. A browser window will open in 3 seconds");
	logger.log(`   2. Please log in to ${config.name} in the browser`);
	logger.log("   3. The browser will close automatically once logged in");
	logger.log("   4. Timeout: 8 minutes\n");

	logger.warn("⏰ Preparing to open browser...");

	// Countdown before launch
	for (let i = 3; i > 0; i--) {
		process.stdout.write(`\r   Opening in ${i} seconds...`);
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	process.stdout.write("\r   Opening browser now!     \n\n");

	const browser = await chromium.launch({
		headless: false,
		args: [
			"--disable-blink-features=AutomationControlled",
			"--no-sandbox",
			"--disable-setuid-sandbox",
		],
	});

	const contextOptions: Parameters<typeof browser.newContext>[0] = {
		viewport: null,
	};

	if (fs.existsSync(authFile)) {
		contextOptions.storageState = authFile;
	}

	const loginContext = await browser.newContext(contextOptions);

	try {
		const loginPage = await loginContext.newPage();

		logger.log(
			"✅ Browser opened - Please complete login in the browser window",
		);
		logger.log("⏳ Waiting for authentication...\n");

		await loginPage.goto(config.url, {
			waitUntil: "domcontentloaded",
		});

		await waitForAuthentication(loginPage, provider, true); // Skip health check for local auth

		// For Google providers: also visit www.google.com before saving state so that
		// google.com-specific cookies (login_info, SIDCC, NID) are included in the session.
		// Without this, loading the session directly on google.com shows "Sign in"
		// because those www.google.com cookies were never set during Gemini-only auth.
		if (provider === "google" || provider === "google-ai-overview") {
			logger.log("🔄 Visiting google.com to capture full session cookies...");
			await loginPage
				.goto("https://www.google.com", {
					waitUntil: "domcontentloaded",
					timeout: 30000,
				})
				.catch(() => {});
			await loginPage.waitForTimeout(2000);
		}

		await loginContext.storageState({
			path: authFile,
		});

		logger.success(`✅ ${config.name} authentication successful!`);
		logger.log(`📁 Session saved to: ${authFile}\n`);
	} catch (err) {
		logger.error(`Failed to login to ${config.name}:`, err);
		throw err;
	} finally {
		await loginContext.close();
		await browser.close();
	}
}
