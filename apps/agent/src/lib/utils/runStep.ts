import { ExternalServiceError } from "@oneglanse/errors";
import { logger, withTimeout } from "@oneglanse/utils";
import type { Page } from "playwright";

type StepFn = () => Promise<void>;
const STEP_EXECUTION_TIMEOUT_MS = 180_000;

export async function runStep(
	name: string,
	page: Page,
	fn: StepFn,
): Promise<void> {
	const start = Date.now();

	try {
		await withTimeout(name, fn, STEP_EXECUTION_TIMEOUT_MS);
		logger.success(`${name} (${Date.now() - start}ms)`);
	} catch (err) {
		logger.error(`${name} FAILED after ${Date.now() - start}ms`);
		const url = page.url();
		logger.error(`URL at failure: ${url}`);

		throw new ExternalServiceError(
			"step",
			err instanceof Error ? err.message : String(err),
			500,
			{ step: name, url },
			err instanceof Error ? err : undefined,
		);
	}
}
