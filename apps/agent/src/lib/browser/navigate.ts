import type { Page } from "playwright";
import { logger } from "../utils/logger.js";
import { RETRYABLE_ERRORS } from "@oneglanse/utils";

export async function navigateWithRetry(
	page: Page,
	url: string,
	options: Parameters<Page["goto"]>[1] = {},
	maxRetries = 3,
	delayMs = 5000,
): Promise<void> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await page.goto(url, options);
			return;
		} catch (err: any) {
			const message = err?.message ?? "";
			const isRetryable = RETRYABLE_ERRORS.some((e) => message.includes(e));

			if (!isRetryable || attempt === maxRetries) {
				throw err;
			}

			logger.warn(
				`Navigation to ${url} failed (attempt ${attempt}/${maxRetries}): ${message}. Retrying in ${delayMs / 1000}s...`,
			);

			await page.waitForTimeout(delayMs);
		}
	}
}
