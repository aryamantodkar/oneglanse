import { ExternalServiceError } from "@oneglanse/errors";
import { exponentialBackoff, logger } from "@oneglanse/utils";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { getText } from "../../lib/input/response/getText.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";

const MAX_EXTRACTION_RETRIES = 2;
const INITIAL_EXTRACTION_RETRY_DELAY = 1_500;
const MAX_EXTRACTION_RETRY_DELAY = 5_000;

export async function fetchPromptResponses(
	page: Page,
	provider: Provider,
): Promise<string> {
	const config = PROVIDER_CONFIGS[provider];

	await config.waitForResponse(page);

	for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
		await page.waitForTimeout(150);

		const response = await config.extractResponse(page);

		if (response && response.length > 0) {
			logger.debug(`response extracted (${response.length} chars)`);
			return response;
		}

		if (attempt < MAX_EXTRACTION_RETRIES) {
			const retryDelay =
				attempt <= 1
					? INITIAL_EXTRACTION_RETRY_DELAY
					: exponentialBackoff(
							attempt - 1,
							INITIAL_EXTRACTION_RETRY_DELAY,
							MAX_EXTRACTION_RETRY_DELAY,
						);
			logger.warn(
				`extraction empty, retrying in ${retryDelay / 1000}s (attempt ${attempt}/${MAX_EXTRACTION_RETRIES})`,
			);
			await page.waitForTimeout(retryDelay);
		}
	}

	const visibleTextChars = (await getText(page, provider).catch(() => ""))?.trim().length ?? 0;
	throw new ExternalServiceError(
		provider,
		`Markdown response extraction failed after ${MAX_EXTRACTION_RETRIES} retries`,
		502,
		{ visibleTextChars, retries: MAX_EXTRACTION_RETRIES },
	);
}
