import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { PROVIDER_LIST, type Provider } from "@onescope/types";
import { PROVIDERS } from "@onescope/utils";
import dotenv from "dotenv";
import { chromium } from "playwright-extra";
import { waitForUserLogin } from "../lib/auth/waitForUserLogin.js";
import { logger } from "../lib/utils/logger.js";

if (fs.existsSync("apps/agent/.env")) {
	dotenv.config({ path: "apps/agent/.env" });
} else if (fs.existsSync(".env")) {
	dotenv.config();
}

if (!process.env.LOCAL_AUTH_PROFILE_PATH) {
	throw new Error("LOCAL_AUTH_PROFILE_PATH is not set");
}

const USER_DATA_DIR = path.resolve(process.env.LOCAL_AUTH_PROFILE_PATH);

function promptUser(question: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdout.write(question);

		// Enable raw mode to capture single keypress
		process.stdin.setRawMode(true);
		process.stdin.resume();

		const onKeypress = (chunk: Buffer) => {
			const key = chunk.toString().toLowerCase();

			// Only accept 'y' or 'n'
			if (key === "y" || key === "n") {
				process.stdout.write(`${key}\n`); // Echo the key and newline
				process.stdin.setRawMode(false);
				process.stdin.pause();
				process.stdin.removeListener("data", onKeypress);
				resolve(key);
			}
			// Ignore other keys (just don't respond)
		};

		process.stdin.on("data", onKeypress);
	});
}

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

		await waitForUserLogin(loginPage, provider, true); // Skip health check for local auth

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

export async function loginToAll(): Promise<void> {
	logger.log("\n🔐 AUTHENTICATION SETUP");
	logger.log(`${"=".repeat(70)}\n`);

	logger.log("📊 This will authenticate you with all AI models:");
	logger.log("   • ChatGPT");
	logger.log("   • Claude");
	logger.log("   • Perplexity");
	logger.log("   • Gemini (also used for AI Overview)\n");

	const results = Object.fromEntries(
		PROVIDER_LIST.map((p) => [p, "skipped" as const]),
	) as Record<Provider, "success" | "failed" | "skipped">;

	// google-ai-overview shares the google (Gemini) session — skip it in the login loop
	const loginProviders = (Object.keys(PROVIDERS) as Provider[]).filter(
		(p) => p !== "google-ai-overview",
	);

	for (const provider of loginProviders) {
		// Ask user if they want to authenticate this provider
		logger.log(`\n❓ Login to ${PROVIDERS[provider].displayName}?`);
		const answer = await promptUser("   (y/n): ");

		if (answer !== "y" && answer !== "yes") {
			logger.log(`⏭️  Skipped ${PROVIDERS[provider].displayName}\n`);
			results[provider] = "skipped";
			continue;
		}

		try {
			await loginToProvider(provider);
			results[provider] = "success";
		} catch (err: any) {
			results[provider] = "failed";

			logger.error(`❌ ${PROVIDERS[provider].name} authentication failed`);
			logger.error(`   Error: ${err.message}\n`);

			logger.warn("⚠️  Options:");
			logger.warn("   • Continue to next provider");
			logger.warn(
				`   • Retry this provider later with: pnpm run auth:${provider}`,
			);
			logger.warn(`   • Skip if you don't need ${PROVIDERS[provider].name}\n`);
		}
	}

	// Summary
	logger.log(`\n${"=".repeat(70)}`);
	logger.log("📊 AUTHENTICATION SUMMARY");
	logger.log(`${"=".repeat(70)}\n`);

	const successCount = Object.values(results).filter(
		(r) => r === "success",
	).length;
	const failedCount = Object.values(results).filter(
		(r) => r === "failed",
	).length;
	const skippedCount = Object.values(results).filter(
		(r) => r === "skipped",
	).length;

	for (const [provider, status] of Object.entries(results)) {
		const icon = status === "success" ? "✅" : status === "failed" ? "❌" : "⏭️";
		const label = `${PROVIDERS[provider as Provider].name}:`.padEnd(15);
		logger.log(`${icon} ${label} ${status.toUpperCase()}`);
	}

	logger.log();

	const attemptedCount = loginProviders.length - skippedCount;

	if (successCount === attemptedCount && attemptedCount > 0) {
		logger.success("🎉 All attempted providers authenticated successfully!");
		if (skippedCount > 0) {
			logger.log(`⏭️  ${skippedCount} provider(s) skipped`);
		}
	} else if (successCount > 0) {
		logger.warn(
			`⚠️  ${successCount}/${attemptedCount} attempted providers authenticated, ${failedCount} failed`,
		);
		if (skippedCount > 0) {
			logger.log(`⏭️  ${skippedCount} provider(s) skipped`);
		}
		logger.log("💡 You can retry failed providers individually");
	} else if (attemptedCount === 0) {
		logger.warn("⏭️  All providers skipped - no authentication performed");
	} else {
		logger.error("❌ All attempted authentications failed");
		logger.log("💡 Check your internet connection and try again");
	}

	logger.log();
}

export function checkAuthStatus(): void {
	logger.log(`\n${"=".repeat(70)}`);
	logger.log("📊 CURRENT AUTHENTICATION STATUS");
	logger.log(`${"=".repeat(70)}\n`);

	const statuses: Array<{
		provider: string;
		authenticated: boolean;
		lastUpdated?: string;
	}> = [];

	for (const [key, config] of Object.entries(PROVIDERS)) {
		// google-ai-overview reuses google (Gemini) auth — skip its own file check
		if (key === "google-ai-overview") continue;

		const authPath = path.join(USER_DATA_DIR, config.name);
		const authFile = path.join(authPath, `${config.name}-auth.json`);
		const exists = fs.existsSync(authFile);

		statuses.push({
			provider: config.name,
			authenticated: exists,
			lastUpdated: exists
				? fs.statSync(authFile).mtime.toLocaleString()
				: undefined,
		});
	}

	// Display in table format
	for (const status of statuses) {
		const icon = status.authenticated ? "✅" : "❌";
		const label = `${status.provider}:`.padEnd(15);
		const authStatus = status.authenticated
			? "AUTHENTICATED"
			: "NOT AUTHENTICATED";

		logger.log(`${icon} ${label} ${authStatus}`);

		if (status.lastUpdated) {
			logger.log(`${"".padEnd(20)}Last updated: ${status.lastUpdated}`);
		}
		logger.log();
	}

	const authenticatedCount = statuses.filter((s) => s.authenticated).length;
	const total = statuses.length;

	logger.log("ℹ️  AI Overview:      shares Gemini session\n");

	if (authenticatedCount === total) {
		logger.success("✅ All providers are authenticated\n");
	} else if (authenticatedCount > 0) {
		logger.warn(`⚠️  ${authenticatedCount}/${total} providers authenticated\n`);
	} else {
		logger.warn("⚠️  No providers authenticated yet\n");
	}
}

async function runHeadedLogin(): Promise<void> {
	checkAuthStatus();

	// Check if single provider mode
	const targetProvider = process.env.PROVIDER as Provider | undefined;

	if (targetProvider) {
		if (!PROVIDERS[targetProvider]) {
			logger.error(`❌ Unknown provider: ${targetProvider}`);
			logger.log(`   Valid providers: ${Object.keys(PROVIDERS).join(", ")}`);
			process.exit(1);
		}

		logger.log(
			`\n🎯 Single Provider Mode: ${PROVIDERS[targetProvider].name}\n`,
		);
		await loginToProvider(targetProvider);
	} else {
		await loginToAll();
	}
}

if (process.env.RUN_INTERACTIVE_LOGIN === "true") {
	runHeadedLogin().catch((err) => {
		logger.error("Login flow failed", err);
		process.exit(1);
	});
}
