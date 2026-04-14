import { toErrorMessage } from "@oneglanse/errors";
import type { Source } from "@oneglanse/types";
import { logger, PROVIDER_MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";
import { type RawSource, buildSources } from "../../_shared/sourceUtils.js";

export const CLAUDE_RAW_SOURCES_DOM_EXTRACTOR = String.raw`(
	{
		getCachedRawSources,
		setCachedRawSources,
		findLatestResponseElement,
		extractClaudeRawSourcesFromResponseElement,
	},
	selectors,
) => {
	const cached = getCachedRawSources("claude");
	if (cached) return cached;

	const responseEl = findLatestResponseElement(selectors)?.element;
	if (!responseEl) return [];

	const rawSources = extractClaudeRawSourcesFromResponseElement(responseEl);
	setCachedRawSources("claude", rawSources);
	return rawSources;
}`;

export async function extractSourcesFromClaude(page: Page): Promise<Source[]> {
	try {
		const rawSources = await page.runDomOp<RawSource[]>("raw-sources", {
			provider: "claude",
			selectors: PROVIDER_MODEL_RESPONSE_SELECTORS.claude || [],
		});
		return buildSources(rawSources, { provider: "claude" });
	} catch (error) {
		logger.error(`Failed to extract Claude sources: ${toErrorMessage(error)}`);
		return [];
	}
}
