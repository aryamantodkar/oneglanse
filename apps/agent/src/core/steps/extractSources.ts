import type { Provider, Source } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { extractResolvedSources } from "../../lib/selectors/intelligence.js";

export async function checkAndExtractSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	try {
		logger.log(`[${provider}] extracting sources`);
		const sources = await extractResolvedSources(page, provider);
		logger.log(`[${provider}] ${sources.length} sources extracted`);
		return sources;
	} catch (err) {
		logger.warn(`[${provider}] source extraction failed, continuing:`, err);
		return [];
	}
}
