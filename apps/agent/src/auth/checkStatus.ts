import fs from "node:fs";
import path from "node:path";
import { PROVIDERS } from "@onescope/utils";
import { logger } from "../lib/utils/logger.js";
import { USER_DATA_DIR } from "./config.js";

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
