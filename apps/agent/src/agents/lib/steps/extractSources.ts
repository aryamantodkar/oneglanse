import type { Provider, Source } from "@onescope/types";
import type { Page } from "playwright";
import { logger } from "../../../lib/utils/logger.js";
import { AGENT_PROVIDER_CONFIG } from "../providerRegistry.js";

export async function checkAndExtractSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	let sources: Source[] = [];

	try {
		sources = await extractSourcesFromPanel(page, provider);
	} catch (err) {
		logger.warn("Failed to extract sources, continuing:", err);
		sources = [];
	}

	return sources;
}

export async function extractSourcesFromPanel(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	logger.debug("🔍 Opening sources panel (latest response only)...");

	await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(1000);

	const sources = await AGENT_PROVIDER_CONFIG[provider].extractSources(page);

	logger.debug(`✅ Extracted ${sources.length} sources`);

	await page.waitForTimeout(1000);

	return sources;
}
