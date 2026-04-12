import type { Source } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import {
	type RawSource,
	buildSources,
	clickButtonViaDispatch,
} from "../../_shared/sourceUtils.js";

export async function extractSourcesFromChatgpt(
	page: Page,
	sourcesButton: Locator,
): Promise<Source[]> {
	const rawSources = (await page.runDomOp("raw-sources", {
		provider: "chatgpt",
	})) as RawSource[];

	if (!(await clickButtonViaDispatch(page, sourcesButton))) return [];
	await page.waitForTimeout(300);

	// Preserve original dedup key: same URL+title can appear with different citedText
	return buildSources(
		rawSources,
		(url, title, citedText) => `${url}|${title}|${citedText}`,
	);
}
