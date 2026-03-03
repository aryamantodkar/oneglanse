import { downloadCsv, downloadJson } from "@/lib/export/download";
import { buildAnalysisCsvRow } from "@/lib/export/analysisCsvRow";
import type { DashboardMetrics } from "./types";

export function exportAnalysisJson(args: {
	workspaceId: string;
	metrics: DashboardMetrics;
	modelFilter: string;
	timeFilter: string;
}): void {
	const { workspaceId, metrics, modelFilter, timeFilter } = args;
	const generatedAt = new Date().toISOString();

	const topCompetitors = metrics.competitorData
		.filter((competitor) => !competitor.isBrand)
		.slice(0, 5);

	const actionPriorities = [
		metrics.aggregateStats.presenceRate < 70
			? "Increase brand mention frequency across high-intent prompts."
			: null,
		(metrics.avgRank.position ?? 99) > 3
			? "Improve ranking consistency by strengthening comparison-oriented messaging."
			: null,
		metrics.impactMetrics.topPickRate < 35
			? "Raise top-pick conversion with stronger differentiators and proof points."
			: null,
		metrics.impactMetrics.criticalRiskCount > 0
			? "Resolve critical risk signals found in model answers."
			: null,
	].filter(Boolean);

	const promptRows = metrics.analyzedRecords.map((record) => ({
		promptId: record.prompt_id,
		prompt: record.prompt,
		modelProvider: record.model_provider,
		promptRunAt: record.prompt_run_at,
		geoScore: record.brand_analysis?.geoScore?.overall ?? null,
		sentiment: record.brand_analysis?.sentiment?.score ?? null,
		visibility: record.brand_analysis?.presence?.visibility ?? null,
		position: record.brand_analysis?.position?.rankPosition ?? null,
		recommendation: record.brand_analysis?.recommendation?.type ?? null,
		citations: record.sources?.length ?? 0,
		sources: (record.sources ?? []).map((source) => ({
			title: source.title ?? "",
			url: source.url ?? "",
			domain: source.domain ?? "",
			citedText: source.cited_text ?? "",
		})),
	}));

	downloadJson(`dashboard-${workspaceId}-${Date.now()}.json`, {
		generatedAt,
		workspaceId,
		report: {
			title: "AI Visibility Dashboard Export",
			version: "2.0",
			filters: { modelFilter, timeFilter },
		},
		overview: {
			brandName: metrics.brandName,
			brandDomain: metrics.brandDomain,
			responsesAnalyzed: metrics.analyzedRecords.length,
			citationsCaptured: metrics.totalCitations,
		},
		impactSummary: {
			presenceRate: `${metrics.aggregateStats.presenceRate}%`,
			averageRank: metrics.avgRank.position,
			recommendationRate: `${metrics.impactMetrics.recommendationRate}%`,
			topPickRate: `${metrics.impactMetrics.topPickRate}%`,
			avgSentiment: metrics.avgSentiment.score,
			topSourceDomain: metrics.sourcesIntelligence[0]?.domain ?? null,
			topCompetitor: metrics.aggregateStats.topCompetitor,
		},
		actionPriorities:
			actionPriorities.length > 0
				? actionPriorities
				: ["Maintain current trajectory and scale winning prompt themes."],
		leaderboards: {
			competitors: topCompetitors,
			sources: metrics.sourcesIntelligence.slice(0, 10),
		},
		detailedData: {
			competitors: metrics.competitorData,
			sources: metrics.sourcesIntelligence,
			prompts: promptRows,
		},
	});
}

export function exportAnalysisCsv(args: {
	workspaceId: string;
	metrics: DashboardMetrics;
}): void {
	const { workspaceId, metrics } = args;

	const rows = [
		{ section: "overview", metric: "Brand", value: metrics.brandName },
		{ section: "overview", metric: "Domain", value: metrics.brandDomain },
		{
			section: "overview",
			metric: "Responses Analyzed",
			value: metrics.analyzedRecords.length,
		},
		{
			section: "impact_summary",
			metric: "Presence Rate",
			value: `${metrics.aggregateStats.presenceRate}%`,
		},
		{
			section: "impact_summary",
			metric: "Average Rank",
			value: metrics.avgRank.position ?? "N/A",
		},
		{
			section: "impact_summary",
			metric: "Recommendation Rate",
			value: `${metrics.impactMetrics.recommendationRate}%`,
		},
		{
			section: "impact_summary",
			metric: "Top Pick Rate",
			value: `${metrics.impactMetrics.topPickRate}%`,
		},
		...metrics.analyzedRecords.map((record) =>
			buildAnalysisCsvRow(record, "prompt_details"),
		),
	];

	downloadCsv(`dashboard-${workspaceId}-${Date.now()}.csv`, rows);
}
