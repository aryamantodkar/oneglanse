import fs from "node:fs";
import path from "node:path";
import { PROVIDER_LIST, type Provider } from "@onescope/types";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import { logger } from "../lib/utils/logger.js";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import { isAuthenticated } from "../lib/auth/isAuthenticated.js";
import {
	LOCAL_AUTH_BROWSER_PROFILE_PATH,
	USER_DATA_DIR,
} from "./config.js";
import { loginToProvider } from "./loginToProvider.js";

function getAuthFile(provider: Provider): string {
	return path.join(USER_DATA_DIR, provider, `${provider}-auth.json`);
}

export async function loginToAll(): Promise<void> {
	logger.log("\n🔐 AUTHENTICATION SETUP");
	logger.log(`${"=".repeat(70)}\n`);

	logger.log("📊 This will authenticate you with all AI models:");
	logger.log("   • ChatGPT");
	logger.log("   • Claude");
	logger.log("   • Perplexity");
	logger.log("   • Gemini (also used for AI Overview)\n");
	logger.log("⚡ Frictionless mode: no per-provider prompts; only missing/expired sessions will open login.");
	logger.log();

	const results = Object.fromEntries(
		PROVIDER_LIST.map((p) => [p, "skipped" as const]),
	) as Record<Provider, "success" | "failed" | "skipped">;

	// google-ai-overview shares the google (Gemini) session — skip it in the login loop
	const loginProviders = (Object.keys(AGENT_PROVIDER_CONFIG) as Provider[]).filter(
		(p) => p !== "google-ai-overview",
	);

	const providersNeedingAuth: Provider[] = [];
	for (const provider of loginProviders) {
		const authFile = getAuthFile(provider);
		const displayName = AGENT_PROVIDER_CONFIG[provider].displayName;

		if (!fs.existsSync(authFile)) {
			logger.log(`🆕 ${displayName}: no saved session, login required.`);
			providersNeedingAuth.push(provider);
			continue;
		}

		const lastUpdated = fs.statSync(authFile).mtime.toLocaleString();
		logger.log(`✅ ${displayName}: saved session found (${lastUpdated}) — skipping`);
		results[provider] = "skipped";
	}

	if (providersNeedingAuth.length === 0) {
		logger.success("✅ All providers already have valid sessions. No interactive login needed.");
		logger.log();
		return;
	}

	logger.log(
		`\n🌐 Opening one shared browser window for ${providersNeedingAuth.length} provider(s) that need auth.\n`,
	);

	let sharedContext: BrowserContext | undefined;
	let sharedPage: Page | undefined;

	sharedContext = await chromium.launchPersistentContext(
		LOCAL_AUTH_BROWSER_PROFILE_PATH,
		{
			headless: false,
			args: [
				"--disable-blink-features=AutomationControlled",
				"--no-sandbox",
				"--disable-setuid-sandbox",
			],
			viewport: null,
		},
	);

	sharedPage = await sharedContext.newPage();

	try {
		for (const provider of providersNeedingAuth) {
			const authFile = getAuthFile(provider);
			const displayName = AGENT_PROVIDER_CONFIG[provider].displayName;

			logger.log(`🔎 ${displayName}: checking existing account in shared browser...`);
			await sharedPage
				.goto(AGENT_PROVIDER_CONFIG[provider].url, {
					waitUntil: "domcontentloaded",
					timeout: 45000,
				})
				.catch(() => {});
			await sharedPage.waitForTimeout(1200);

			const alreadyLoggedIn = await isAuthenticated(sharedPage, provider, true);
			if (alreadyLoggedIn) {
				await sharedContext.storageState({ path: authFile });
				logger.log(
					`✅ ${displayName}: existing account detected, session exported automatically.`,
				);
				results[provider] = "success";
				continue;
			}

			try {
				await loginToProvider(provider, {
					loginContext: sharedContext,
					loginPage: sharedPage,
					skipCountdown: true,
				});
				results[provider] = "success";
			} catch (err: any) {
				results[provider] = "failed";

				logger.error(`❌ ${provider} authentication failed`);
				logger.error(`   Error: ${err.message}\n`);

				logger.warn("⚠️  Options:");
				logger.warn("   • Continue to next provider");
				logger.warn(`   • Retry this provider later with: pnpm run auth:${provider}`);
				logger.warn(`   • Skip if you don't need ${provider}\n`);
			}
		}
	} finally {
		if (sharedContext) {
			await sharedContext.close().catch(() => {});
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
		const label = `${provider}:`.padEnd(15);
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
