import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import {
	canUseOsLevelInput,
	pressKeyLikeUser,
} from "../../../../lib/browser/humanBehavior.js";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export async function extractSourcesFromPerplexity(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = (await page.runDomOp("raw-sources", {
		provider: "perplexity",
	})) as RawSource[];

	const clickedToClose = await clickButtonViaDispatch(page, sourcesButton).catch(
		() => false,
	);
	if (!clickedToClose) {
		const escaped = await pressKeyLikeUser(page, "Escape").catch(() => false);
		if (!escaped && canUseOsLevelInput(page)) {
			return buildSources(rawSources);
		}
	}

	await page.waitForTimeout(300);
	const escaped = await pressKeyLikeUser(page, "Escape").catch(() => false);
	if (!escaped && canUseOsLevelInput(page)) {
		return buildSources(rawSources);
	}
	await page.waitForTimeout(300);

	return buildSources(rawSources);
}
