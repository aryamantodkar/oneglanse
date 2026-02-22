import fs from "node:fs";
import path from "node:path";
import { PROVIDER_LIST, type Provider } from "@onescope/types";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import { logger } from "../lib/utils/logger.js";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import {
	LOCAL_AUTH_BROWSER_PROFILE_PATH,
	USER_DATA_DIR,
} from "./config.js";
import { loginToProvider } from "./loginToProvider.js";

function getAuthFile(provider: Provider): string {
	return path.join(USER_DATA_DIR, provider, `${provider}-auth.json`);
}

export async function loginToAll(): Promise<void> {
	logger.log("\nLogin providers");

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

		if (!fs.existsSync(authFile)) {
			providersNeedingAuth.push(provider);
			continue;
		}

		results[provider] = "skipped";
	}

	if (providersNeedingAuth.length === 0) {
		logger.success("No login needed. All provider sessions already exist.");
		logger.log();
		return;
	}

	logger.log(`Need login: ${providersNeedingAuth.length} provider(s)`);

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
		for (const [index, provider] of providersNeedingAuth.entries()) {
			const displayName = AGENT_PROVIDER_CONFIG[provider].displayName;

			logger.log(`[${index + 1}/${providersNeedingAuth.length}] ${displayName}`);

			try {
				await loginToProvider(provider, {
					loginContext: sharedContext,
					loginPage: sharedPage,
					skipCountdown: true,
				});
				results[provider] = "success";
			} catch (err: any) {
				results[provider] = "failed";

				logger.error(`${displayName}: failed`);
				logger.error(`Reason: ${err.message}`);
			}
		}
	} finally {
		if (sharedContext) {
			await sharedContext.close().catch(() => {});
		}
	}

	const successCount = Object.values(results).filter(
		(r) => r === "success",
	).length;
	const failedCount = Object.values(results).filter(
		(r) => r === "failed",
	).length;
	const skippedCount = Object.values(results).filter(
		(r) => r === "skipped",
	).length;

	const attemptedCount = loginProviders.length - skippedCount;

	if (successCount === attemptedCount && attemptedCount > 0) {
		logger.success(`Login complete: success=${successCount}, skipped=${skippedCount}, failed=${failedCount}`);
	} else if (successCount > 0) {
		logger.warn(`Login complete: success=${successCount}, skipped=${skippedCount}, failed=${failedCount}`);
		logger.warn("Retry failed providers: pnpm run auth:<provider>");
	} else if (attemptedCount === 0) {
		logger.warn("No login actions were needed.");
	} else {
		logger.error("All provider logins failed.");
	}

	logger.log();
}
