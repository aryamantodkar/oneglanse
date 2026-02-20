import type { Page } from "playwright";
import { logger } from "./logger.js";

type StepFn = () => Promise<void>;

export async function runStep(
	name: string,
	page: Page,
	fn: StepFn,
): Promise<void> {
	console.log(`\n▶️  ${name}`);
	const start = Date.now();

	try {
		await fn();
		logger.success(`${name} (${Date.now() - start}ms)`);
	} catch (err) {
		logger.error(`${name} FAILED after ${Date.now() - start}ms`);

		// Capture diagnostics
		try {
			await page.screenshot({
				path: `debug-${name.replace(/\s+/g, "_")}.png`,
				fullPage: true,
			});
			logger.log("📸 Screenshot saved");
		} catch {}

		try {
			const url = page.url();
			logger.error(`URL at failure: ${url}`);
		} catch {}
	}
}
