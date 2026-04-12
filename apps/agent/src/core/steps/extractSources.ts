import type { Provider, Source } from "@oneglanse/types";
import type { Page } from "playwright";
import { logger } from "@oneglanse/utils";
import { PROVIDER_CONFIGS } from "../providers/index.js";

export async function checkAndExtractSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	let sources: Source[] = [];

	try {
		sources = await extractSourcesFromPanel(page, provider);
	} catch (err) {
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
