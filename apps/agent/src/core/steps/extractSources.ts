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
	await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(1000);

	const sources = await PROVIDER_CONFIGS[provider].extractSources(page);

	logger.debug(`extracted ${sources.length} sources`);

	await page.waitForTimeout(1000);

	return sources;
}
