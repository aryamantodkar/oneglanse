import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export async function extractSourcesFromGemini(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = (await page.runDomOp("raw-sources", {
		provider: "gemini",
	})) as RawSource[];

	if (!(await clickButtonViaDispatch(page, sourcesButton))) return [];
	await page.waitForTimeout(300);

	return buildSources(rawSources);
}
