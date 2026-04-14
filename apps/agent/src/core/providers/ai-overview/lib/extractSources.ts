import { toErrorMessage } from "@oneglanse/errors";
import type { Source } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Page } from "playwright";
import { type RawSource, buildSources } from "../../_shared/sourceUtils.js";

export const AI_OVERVIEW_RAW_SOURCES_DOM_EXTRACTOR = String.raw`(_helpers) => {
	const results = [];
	const rhsCol = document.querySelector('[data-container-id="rhs-col"]');
	if (!rhsCol) {
		return { rawSources: results, containerFound: false };
	}

	for (const card of Array.from(rhsCol.querySelectorAll("div[data-src-id]"))) {
		if (!(card instanceof HTMLElement)) continue;

		const link = card.querySelector('a[href^="http"]');
		if (!(link instanceof HTMLAnchorElement)) continue;

		const title =
			link
				.getAttribute("aria-label")
				?.replace(/\.\s*Opens in new tab\.?$/i, "")
				.trim() || link.href;
		const citedText =
			card.querySelector("[data-crb-snippet-text]")?.textContent?.trim() || "";

		results.push({
			rawHref: link.href,
			title,
			citedText,
		});
	}

	return { rawSources: results, containerFound: true };
}`;

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

		return buildSources(normalizedSources, { provider: "ai-overview" });
	} catch (err) {
		logger.error(
			`Failed to extract AI Overview sources: ${toErrorMessage(err)}`,
		);
		return [];
	}
}
