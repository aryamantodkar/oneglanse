import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import { RETRYABLE_ERRORS, logger } from "@oneglanse/utils";
import type { Page } from "playwright";

function jitter(baseMs: number, factor = 0.3): number {
	const delta = Math.round(baseMs * factor);
	const min = Math.max(0, baseMs - delta);
	const max = baseMs + delta;
	return Math.round(min + Math.random() * (max - min));
}

export async function navigateWithRetry(
	page: Page,
	url: string,
	options: Parameters<Page["goto"]>[1] = {},
	maxRetries = 3,
	delayMs = 5000,
): Promise<void> {
	// Set a natural referrer if none is set — direct navigations with empty
	// Referer look suspicious when repeated at scale.
	if (options?.referer === undefined) {
		try {
			const targetHost = new URL(url).hostname;
			const currentUrl = page.url();
			// If we're already on a page, use it as referrer.
			// Otherwise, use Google as a natural referrer source.
			if (currentUrl && currentUrl !== "about:blank") {
				await page.setExtraHTTPHeaders({
					Referer: currentUrl,
				});
			} else if (!targetHost.includes("google")) {
				await page.setExtraHTTPHeaders({
					Referer: "https://www.google.com/",
				});
			}
		} catch {
			// Non-critical — proceed without referrer
		}
	}

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
				`navigation failed (attempt ${attempt}/${maxRetries}): ${message} — retrying in ${Math.round(jitter(delayMs) / 100) / 10}s`,
			);

			await page.waitForTimeout(jitter(delayMs));
		}
	}
}
