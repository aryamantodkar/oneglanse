import type { AnalysisRecord } from "@oneglanse/types";
import { joinCitedTexts, joinSourceUrls } from "../sources/index.js";

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
		position: getExportRank(record.brand_analysis?.position?.rankPosition),
		recommendation: record.brand_analysis?.recommendation?.type ?? "",
		citations: record.sources?.length ?? 0,
		source_urls: joinSourceUrls(record.sources ?? []),
		cited_texts: joinCitedTexts(record.sources ?? []),
	};
}

const csvListSeparator = " | ";

function joinCsvList(
	values: Array<string | number | boolean | null | undefined>,
): string {
	return values
		.map((value) => (value == null ? "" : String(value).trim()))
		.filter((value) => value.length > 0)
		.join(csvListSeparator);
}

function joinUniqueCsvList(
	values: Array<string | number | boolean | null | undefined>,
): string {
	return joinCsvList([...new Set(values)]);
}

function getScoreBand(score: number | null | undefined): string {
	if (score == null) return "N/A";
	if (score >= 75) return "strong";
	if (score >= 50) return "moderate";
	if (score >= 25) return "weak";
	return "critical";
}

function getExportRank(rank: number | null | undefined): number | "N/A" {
	return rank == null || rank <= 0 ? "N/A" : rank;
}

function getRankBucket(rank: number | null | undefined): string {
	if (rank == null || rank <= 0) return "N/A";
	if (rank === 1) return "top_pick";
	if (rank <= 3) return "top_3";
	if (rank <= 10) return "top_10";
	return "below_top_10";
}

function getLlmActionFields(args: {
	brandAnalysis: AnalysisRecord["brand_analysis"];
	riskCritical: number;
	riskWarning: number;
	citationCount: number;
}): Record<string, string> {
	const { brandAnalysis, riskCritical, riskWarning, citationCount } = args;
	const focus: string[] = [];
	const reasons: string[] = [];

	if (!brandAnalysis) {
		return {
			llm_priority: "high",
			llm_action_focus: "analysis_coverage",
			llm_action_reasons:
				"No parsed brand analysis is available for this response.",
		};
	}

	const geoScore = brandAnalysis.geoScore?.overall;
	const visibility = brandAnalysis.presence?.visibility;
	const sentiment = brandAnalysis.sentiment?.score;
	const rank = brandAnalysis.position?.rankPosition;
	const recommendation = brandAnalysis.recommendation?.type;

	if (!brandAnalysis.presence?.mentioned) {
		focus.push("brand_presence");
		reasons.push("Brand was not mentioned in the model response.");
	}

	if (geoScore != null && geoScore < 50) {
		focus.push("geo_score");
		reasons.push(`GEO score is ${geoScore}.`);
	}

	if (rank == null || rank <= 0) {
		focus.push("ranking");
		reasons.push("Brand has no rank position in the response.");
	} else if (rank > 3) {
		focus.push("ranking");
		reasons.push(`Brand ranks at position ${rank}.`);
	}

	if (visibility != null && visibility < 50) {
		focus.push("visibility");
		reasons.push(`Visibility is ${visibility}%.`);
	}

	if (sentiment != null && sentiment < 50) {
		focus.push("sentiment");
		reasons.push(`Sentiment score is ${sentiment}.`);
	}

	if (
		recommendation === "discouraged" ||
		recommendation === "not_mentioned" ||
		recommendation === "mentioned_only"
	) {
		focus.push("recommendation");
		reasons.push(`Recommendation status is ${recommendation}.`);
	}

	if (riskCritical > 0) {
		focus.push("critical_risks");
		reasons.push(`${riskCritical} critical risk signal(s) detected.`);
	}

	if (riskWarning > 0) {
		focus.push("warning_risks");
		reasons.push(`${riskWarning} warning risk signal(s) detected.`);
	}

	if (citationCount === 0) {
		focus.push("citations");
		reasons.push("No citation sources were captured for this response.");
	}

	const priority =
		riskCritical > 0 ||
		!brandAnalysis.presence?.mentioned ||
		(geoScore != null && geoScore < 40)
			? "high"
			: focus.length > 0
				? "medium"
				: "low";

	return {
		llm_priority: priority,
		llm_action_focus: joinUniqueCsvList(
			focus.length > 0 ? focus : ["maintain_and_expand"],
		),
		llm_action_reasons: joinCsvList(
			reasons.length > 0
				? reasons
				: ["Current record has no immediate negative signal."],
		),
	};
}

/**
 * Full per-record row with every available metric for LLM ingestion.
 * Arrays are pipe-delimited strings; nested data is serialized as JSON.
 */
export function buildDetailedAnalysisCsvRow(
	record: AnalysisRecord,
): Record<string, unknown> {
	const ba = record.brand_analysis;
	const risks = ba?.risks?.items ?? [];
	const competitors = ba?.competitors ?? [];
	const sources = record.sources ?? [];
	const perception = ba?.perception;
	const riskCritical = risks.filter((r) => r.severity === "critical").length;
	const riskWarning = risks.filter((r) => r.severity === "warning").length;
	const riskInfo = risks.filter((r) => r.severity === "info").length;
	const citationCount = sources.length;
	const llmActionFields = getLlmActionFields({
		brandAnalysis: ba,
		riskCritical,
		riskWarning,
		citationCount,
	});

	return {
		section: "analysis_records",

		// Identifiers
		record_id: record.id,
		prompt_id: record.prompt_id,
		workspace_id: record.workspace_id,
		model_provider: record.model_provider,
		prompt_run_at: record.prompt_run_at,
		created_at: record.created_at,
		is_analysed: record.is_analysed ?? false,
		analysis_status: record.is_analysed ? "analysed" : "raw",
		has_brand_analysis: Boolean(ba),

		// Brand metadata
		brand_name: ba?.metadata?.brandName ?? "",
		brand_domain: ba?.metadata?.brandDomain ?? "",
		brand_analysis: ba ?? null,

		// Prompt and response
		prompt: record.prompt,
		prompt_length: record.prompt.length,
		response: record.response ?? "",
		response_length: record.response?.length ?? 0,

		// Core scores
		geo_score: ba?.geoScore?.overall ?? "",
		geo_score_band: getScoreBand(ba?.geoScore?.overall),
		sentiment: ba?.sentiment?.score ?? "",
		sentiment_band: getScoreBand(ba?.sentiment?.score),
		visibility: ba?.presence?.visibility ?? "",
		visibility_band: getScoreBand(ba?.presence?.visibility),
		rank_position: getExportRank(ba?.position?.rankPosition),
		rank_bucket: getRankBucket(ba?.position?.rankPosition),

		// Presence and recommendation
		brand_mentioned: ba?.presence?.mentioned ?? "",
		recommendation: ba?.recommendation?.type ?? "",
		is_top_pick: ba?.recommendation?.type === "top_pick",
		is_recommended:
			ba?.recommendation?.type === "top_pick" ||
			ba?.recommendation?.type === "strong_alternative" ||
			ba?.recommendation?.type === "conditional",

		// Brand perception
		best_known_for: perception?.bestKnownFor ?? "",
		pricing_perception: perception?.pricingPerception ?? "",
		core_claims: joinCsvList(perception?.coreClaims ?? []),
		differentiators: joinCsvList(perception?.differentiators ?? []),
		core_claim_count: perception?.coreClaims?.length ?? 0,
		differentiator_count: perception?.differentiators?.length ?? 0,

		// Risks
		risk_total: risks.length,
		risk_critical: riskCritical,
		risk_warning: riskWarning,
		risk_info: riskInfo,
		risk_severities: joinCsvList(risks.map((r) => r.severity)),
		risks,

		// Competitors
		competitor_count: competitors.length,
		competitor_names: joinCsvList(competitors.map((c) => c.name)),
		competitor_domains: joinCsvList(competitors.map((c) => c.domain)),
		competitor_rank_positions: joinCsvList(
			competitors.map((c) => getExportRank(c.rankPosition)),
		),
		competitor_visibilities: joinCsvList(competitors.map((c) => c.visibility)),
		competitor_sentiments: joinCsvList(competitors.map((c) => c.sentiment)),
		recommended_competitors: joinCsvList(
			competitors.filter((c) => c.isRecommended).map((c) => c.name),
		),
		top_ranked_competitor:
			competitors
				.filter((c) => c.rankPosition != null && c.rankPosition > 0)
				.sort((a, b) => (a.rankPosition ?? 999) - (b.rankPosition ?? 999))[0]
				?.name ?? "",
		competitors,

		// Sources and citations
		citation_count: citationCount,
		source_urls: joinSourceUrls(sources),
		source_domains: joinCsvList(sources.map((s) => s.domain)),
		unique_source_domains: joinUniqueCsvList(sources.map((s) => s.domain)),
		source_titles: joinCsvList(sources.map((s) => s.title)),
		source_favicons: joinCsvList(sources.map((s) => s.favicon)),
		cited_texts: joinCitedTexts(sources),
		cited_text_count: sources.filter((s) => s.cited_text?.trim()).length,
		sources,

		// LLM action helpers
		...llmActionFields,
	};
}
