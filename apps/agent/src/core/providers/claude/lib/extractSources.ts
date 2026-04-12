import { toErrorMessage } from "@oneglanse/errors";
import type { Source } from "@oneglanse/types";
import { logger, PROVIDER_MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import type { Page } from "playwright";
import { type RawSource, buildSources } from "../../_shared/sourceUtils.js";

export async function extractSourcesFromClaude(page: Page): Promise<Source[]> {
	try {
		const rawSources = await page.runDomOp<RawSource[]>("raw-sources", {
			provider: "claude",
			selectors: PROVIDER_MODEL_RESPONSE_SELECTORS.claude || [],
		});
		return buildSources(rawSources, (url, title, citedText) => `${url}|${title}|${citedText}`);
	} catch (error) {
		logger.error(`Failed to extract Claude sources: ${toErrorMessage(error)}`);
		return [];
	}
}
