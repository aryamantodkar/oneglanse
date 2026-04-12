import { toErrorMessage } from "@oneglanse/errors";
import type { Source } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { type RawSource, buildSources } from "../../_shared/sourceUtils.js";

function normalizeAIOverviewTitle(title: string): string {
	return title.replace(/\s*\.?\s*opens in new tab\.?\s*$/i, "").trim();
}

export async function extractAIOverviewSources(page: Page): Promise<Source[]> {
	try {
		const { rawSources, containerFound } = await page.runDomOp<{
			rawSources: RawSource[];
			containerFound: boolean;
		}>("raw-sources", {
			provider: "ai-overview",
		});

		if (!containerFound) {
			logger.warn("AI Overview container not found — no sources extracted");
		}

		const normalizedSources = (rawSources as RawSource[]).map((source) => ({
			...source,
			title: normalizeAIOverviewTitle(source.title ?? "") || source.rawHref,
		}));

		return buildSources(normalizedSources, (url) => url);
	} catch (err) {
		logger.error(
			`Failed to extract AI Overview sources: ${toErrorMessage(err)}`,
		);
		return [];
	}
}
