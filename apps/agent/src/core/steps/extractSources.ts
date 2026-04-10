import type { Provider, Source } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { PROVIDER_CONFIGS } from "../providers/index.js";
import { extractResolvedSources } from "../../lib/selectors/index.js";

export async function checkAndExtractSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	try {
		logger.log(`[${provider}] extracting sources`);
		const raw = await extractResolvedSources(page, provider);
		const config = PROVIDER_CONFIGS[provider];
		const sources = config.sanitizeSources ? config.sanitizeSources(raw) : raw;
		logger.log(`[${provider}] ${sources.length} sources extracted`);
		return sources;
	} catch (err) {
		logger.warn(`[${provider}] source extraction failed, continuing:`, err);
		return [];
	}
}
