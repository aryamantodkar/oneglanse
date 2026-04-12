import type { Source } from "@oneglanse/types";
import type { Page } from "playwright";
import {
	canUseOsLevelInput,
	pressKeyLikeUser,
} from "../../../../lib/browser/humanBehavior.js";
import { type RawSource, buildSources } from "../../_shared/sourceUtils.js";

export async function extractSourcesFromPerplexity(
	page: Page,
): Promise<Source[]> {
	const rawSources = (await page.runDomOp("raw-sources", {
		provider: "perplexity",
	})) as RawSource[];

	const escaped = await pressKeyLikeUser(page, "Escape").catch(() => false);
	if (!escaped && canUseOsLevelInput(page)) {
		return buildSources(rawSources);
	}
	await page.waitForTimeout(300);

	return buildSources(rawSources);
}
