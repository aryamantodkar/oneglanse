import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Page } from "playwright";
import { logger, RETRYABLE_ERRORS } from "@oneglanse/utils";

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
		} catch (err) {
			const message = toErrorMessage(err);
			const isRetryable = RETRYABLE_ERRORS.some((e) => message.includes(e));

			if (!isRetryable || attempt === maxRetries) {
				throw new ExternalServiceError(
					"navigation",
					toErrorMessage(err),
					502,
					{ url, attempt },
					err,
				);
			}

			logger.warn(
				`navigation failed (attempt ${attempt}/${maxRetries}): ${message} — retrying in ${delayMs / 1000}s`,
			);

			await page.waitForTimeout(delayMs);
		}
	}
}
