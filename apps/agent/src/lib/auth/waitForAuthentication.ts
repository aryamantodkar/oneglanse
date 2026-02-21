import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { PROVIDERS } from "@onescope/utils";
import { checkPageStability } from "../browser/checkPageStability.js";
import { logger } from "../utils/logger.js";
import { isAuthenticated } from "./isAuthenticated.js";

const TIMEOUT_MS = 8 * 60 * 1000;

export async function waitForAuthentication(
	page: Page,
	provider: Provider,
	skipHealthCheck = false,
): Promise<void> {
	const displayName = PROVIDERS[provider].displayName;
	const pollInterval = 2000;

	const deadline = Date.now() + TIMEOUT_MS;
	const startTime = Date.now();
	let checkCount = 0;

	await page.waitForTimeout(pollInterval);

	while (Date.now() < deadline) {
		checkCount++;
		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		const remaining = Math.floor((deadline - Date.now()) / 1000);
		const minutes = Math.floor(remaining / 60);
		const seconds = remaining % 60;

		await checkPageStability(page);

		if (await isAuthenticated(page, provider, skipHealthCheck)) {
			process.stdout.write(`\r${" ".repeat(80)}\r`);
			logger.success(`✅ ${displayName} session detected (${elapsed}s)`);
			return;
		}

		const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
		process.stdout.write(
			`\r${spinner[checkCount % spinner.length]} Waiting for login... ${minutes}m ${seconds}s remaining (check #${checkCount})`,
		);

		await page.waitForTimeout(pollInterval);
	}

	process.stdout.write(`\r${" ".repeat(80)}\r`);
	logger.error(`❌ ${displayName} login timed out after 8 minutes`);
	logger.warn("💡 Try again or check your internet connection");
}
