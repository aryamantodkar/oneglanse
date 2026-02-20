import type { Page } from "playwright";
import { checkPageStability } from "../../../lib/browser/checkPageStability.js";
import { logger } from "../../../lib/utils/logger.js";
import { isOpenaiAuthenticated } from "./validateAuth.js";

export async function waitForOpenaiAuthentication(
	page: Page,
	timeoutMs: number = 8 * 60 * 1000, // 8 minutes
	skipHealthCheck = false,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	const startTime = Date.now();
	let checkCount = 0;

	await page.waitForTimeout(2000);

	while (Date.now() < deadline) {
		checkCount++;
		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		const remaining = Math.floor((deadline - Date.now()) / 1000);
		const minutes = Math.floor(remaining / 60);
		const seconds = remaining % 60;

		await checkPageStability(page);

		if (await isOpenaiAuthenticated(page, skipHealthCheck)) {
			// Clear progress line and show success
			process.stdout.write(`\r${" ".repeat(80)}\r`);
			logger.success(`✅ ChatGPT session detected (${elapsed}s)`);
			return;
		}

		// Show live progress indicator
		const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
		const spinnerFrame = spinner[checkCount % spinner.length];

		process.stdout.write(
			`\r${spinnerFrame} Waiting for login... ${minutes}m ${seconds}s remaining (check #${checkCount})`,
		);

		await page.waitForTimeout(2000);
	}

	// Timeout - clear progress and show error
	process.stdout.write(`\r${" ".repeat(80)}\r`);
	logger.error("❌ ChatGPT login timed out after 8 minutes");
	logger.warn("💡 Try again or check your internet connection");
}
