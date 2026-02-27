import type { Page } from "playwright";
import { logger } from "./logger.js";
import { withTimeout } from "./withTimeout.js";

type StepFn = () => Promise<void>;
const STEP_EXECUTION_TIMEOUT_MS = Number(
	process.env.STEP_EXECUTION_TIMEOUT_MS ?? 180_000,
);

export async function runStep(
	name: string,
	page: Page,
	fn: StepFn,
): Promise<void> {
	logger.log(`\n▶️  ${name}`);
	const start = Date.now();

	try {
		await withTimeout(name, fn, STEP_EXECUTION_TIMEOUT_MS);
		logger.success(`${name} (${Date.now() - start}ms)`);
	} catch (err) {
		logger.error(`${name} FAILED after ${Date.now() - start}ms`);
		const url = page.url();
		logger.error(`URL at failure: ${url}`);

		throw err;
	}
}
