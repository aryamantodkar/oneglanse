import type { AnalysisRecord } from "@oneglanse/types";
import { joinCitedTexts, joinSourceUrls } from "@oneglanse/utils";

export function buildAnalysisCsvRow(
	record: AnalysisRecord,
	section: string,
): Record<string, string | number> {
	return {
		section,
		prompt: record.prompt,
		model: record.model_provider,
		prompt_run_at: record.prompt_run_at,
		geo_score: record.brand_analysis?.geoScore?.overall ?? "",
		sentiment: record.brand_analysis?.sentiment?.score ?? "",
		visibility: record.brand_analysis?.presence?.visibility ?? "",
		position: record.brand_analysis?.position?.rankPosition ?? "",
		recommendation: record.brand_analysis?.recommendation?.type ?? "",
		citations: record.sources?.length ?? 0,
		source_urls: joinSourceUrls(record.sources ?? []),
		cited_texts: joinCitedTexts(record.sources ?? []),
	};
}
