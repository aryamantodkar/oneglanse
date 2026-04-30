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
		position: record.brand_analysis?.position?.rankPosition ?? "",
		recommendation: record.brand_analysis?.recommendation?.type ?? "",
		citations: record.sources?.length ?? 0,
		source_urls: joinSourceUrls(record.sources ?? []),
		cited_texts: joinCitedTexts(record.sources ?? []),
	};
}

/**
 * Full per-record row with every available metric — suitable for LLM ingestion.
 * Arrays are pipe-delimited strings; competitors serialised as JSON.
 */
export function buildDetailedAnalysisCsvRow(
	record: AnalysisRecord,
): Record<string, unknown> {
	const ba = record.brand_analysis;
	const risks = ba?.risks?.items ?? [];
	const competitors = ba?.competitors ?? [];
	const sources = record.sources ?? [];
	const perception = ba?.perception;

	return {
		// ── Identifiers ──────────────────────────────────────────────────────────
		record_id: record.id,
		prompt_id: record.prompt_id,
		workspace_id: record.workspace_id,
		model: record.model_provider,
		run_at: record.prompt_run_at,
		is_analysed: record.is_analysed ?? false,

		// ── Prompt ───────────────────────────────────────────────────────────────
		prompt: record.prompt,

		// ── Core scores ──────────────────────────────────────────────────────────
		geo_score: ba?.geoScore?.overall ?? "",
		sentiment: ba?.sentiment?.score ?? "",
		visibility: ba?.presence?.visibility ?? "",
		rank_position: ba?.position?.rankPosition ?? "",

		// ── Presence / Recommendation ────────────────────────────────────────────
		brand_mentioned: ba?.presence?.mentioned ?? "",
		recommendation: ba?.recommendation?.type ?? "",

		// ── Brand perception ─────────────────────────────────────────────────────
		best_known_for: perception?.bestKnownFor ?? "",
		pricing_perception: perception?.pricingPerception ?? "",
		core_claims: perception?.coreClaims?.join(" | ") ?? "",
		differentiators: perception?.differentiators?.join(" | ") ?? "",

		// ── Risks ────────────────────────────────────────────────────────────────
		risk_critical: risks.filter((r) => r.severity === "critical").length,
		risk_warning: risks.filter((r) => r.severity === "warning").length,
		risk_info: risks.filter((r) => r.severity === "info").length,

		// ── Competitors ──────────────────────────────────────────────────────────
		competitor_count: competitors.length,
		competitor_names: competitors.map((c) => c.name).join(" | "),
		competitors_json: JSON.stringify(competitors),

		// ── Sources / Citations ──────────────────────────────────────────────────
		citation_count: sources.length,
		source_urls: sources.map((s) => s.url).join(" | "),
		source_domains: sources
			.map((s) => s.domain ?? "")
			.filter(Boolean)
			.join(" | "),
		source_titles: sources.map((s) => s.title ?? "").join(" | "),
		cited_texts: sources
			.map((s) => s.cited_text ?? "")
			.filter(Boolean)
			.join(" | "),

		// ── Full response ─────────────────────────────────────────────────────────
		response: record.response ?? "",
	};
}
