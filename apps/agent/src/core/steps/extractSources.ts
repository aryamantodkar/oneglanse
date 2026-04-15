import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider, Source } from "@oneglanse/types";
import type { Page } from "playwright";
import { logger } from "@oneglanse/utils";
import { PROVIDER_CONFIGS } from "../providers/index.js";

function shouldRetrySourceExtraction(err: unknown): boolean {
	const message = toErrorMessage(err);

	return (
		/execution context was destroyed/i.test(message) ||
		/target page, context or browser has been closed/i.test(message) ||
		/most likely because of a navigation/i.test(message) ||
		/protocol error/i.test(message)
	);
}

export async function checkAndExtractSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	let sources: Source[] = [];

	try {
		sources = await extractSourcesFromPanel(page, provider);
	} catch (err) {
		if (shouldRetrySourceExtraction(err)) {
			throw new ExternalServiceError(
				provider,
				`Source extraction failed due to navigation/context loss — retrying prompt. ${toErrorMessage(err)}`,
			);
		}

		logger.warn("source extraction failed, continuing:", err);
		sources = [];
	}

	return sources;
}

async function extractSourcesFromPanel(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	const sources = await PROVIDER_CONFIGS[provider].extractSources(page);

	if (sources.length > 0) {
		logger.debug(`extracted ${sources.length} sources`);
	}

	return sources;
}
