import type {
	PromptResponse,
	Source,
	SourceGroupResult,
} from "@onescope/types";
import { removeUrlParams } from "../url/removeUrlParams.js";
import { groupSourcesByUrl } from "./groupSourcesByUrl.js";

export function extractSourceStats(
	responses: PromptResponse[],
): SourceGroupResult {
	const combinedSources: (Source & { modelProvider: string })[] = [];
	const sourcesByModel = new Map<
		string,
		(Source & { modelProvider: string })[]
	>();

	for (const resp of responses) {
		if (!Array.isArray(resp.sources)) continue;

		const model = resp.model_provider;

		for (const s of resp.sources) {
			if (!s || typeof s.url !== "string" || typeof s.title !== "string")
				continue;

			const cleanUrl = removeUrlParams(s.url);

			const source: Source & { modelProvider: string } = {
				title: s.title,
				url: cleanUrl,
				cited_text: s.cited_text ?? "",
				domain: s.domain ?? null,
				favicon: s.favicon ?? null,
				modelProvider: model,
			};

			combinedSources.push(source);

			if (!sourcesByModel.has(model)) {
				sourcesByModel.set(model, []);
			}
			sourcesByModel.get(model)!.push(source);
		}
	}

	return {
		combined: groupSourcesByUrl(combinedSources),
		byModel: Object.fromEntries(
			Array.from(sourcesByModel.entries()).map(([model, sources]) => [
				model,
				groupSourcesByUrl(sources),
			]),
		),
	};
}
