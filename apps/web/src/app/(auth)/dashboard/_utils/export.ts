import { downloadCsv, downloadJson } from "@/lib/export/download";
import { buildDetailedAnalysisCsvRow } from "@oneglanse/utils";
import type { DashboardMetrics } from "./types";

function getActionPriorities(metrics: DashboardMetrics): string[] {
	const priorities = [
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
	].filter((priority): priority is string => priority !== null);

	return priorities.length > 0
		? priorities
		: ["Maintain current trajectory and scale winning prompt themes."];
}

function serializeSourceMetrics(
	sources: DashboardMetrics["sourcesIntelligence"],
) {
	return sources.map((source) => ({
		domain: source.domain,
		favicon: source.favicon,
		citationCount: source.citationCount,
		uniqueRecordCount: source.uniqueRecords.size,
		modelCount: source.models.size,
		models: [...source.models],
		uniqueRecords: [...source.uniqueRecords],
	}));
}

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

	const actionPriorities = getActionPriorities(metrics);
	const promptRows = metrics.analyzedRecords.map((record) =>
		buildDetailedAnalysisCsvRow(record),
	);
	const sourceRows = serializeSourceMetrics(metrics.sourcesIntelligence);

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
			totalResponses: metrics.impactMetrics.totalResponses,
			citationsCaptured: metrics.totalCitations,
		},
		impactSummary: {
			presenceRate: `${metrics.aggregateStats.presenceRate}%`,
			averageRank: metrics.avgRank.position,
			recommendationRate: `${metrics.impactMetrics.recommendationRate}%`,
			topPickRate: `${metrics.impactMetrics.topPickRate}%`,
			avgSentiment: metrics.avgSentiment.score,
			avgVisibility: metrics.impactMetrics.avgVisibility,
			criticalRiskCount: metrics.impactMetrics.criticalRiskCount,
			topSourceDomain: metrics.sourcesIntelligence[0]?.domain ?? null,
			topCompetitor: metrics.aggregateStats.topCompetitor,
			topCompetitorDomain: metrics.aggregateStats.topCompetitorDomain,
			totalCitations: metrics.totalCitations,
		},
		actionPriorities,
		brandPerception: metrics.brandPerception,
		leaderboards: {
			competitors: topCompetitors,
			sources: sourceRows.slice(0, 10),
		},
		detailedData: {
			competitors: metrics.competitorData,
			sources: sourceRows,
			prompts: promptRows,
		},
	});
}

export function exportAnalysisCsv(args: {
	workspaceId: string;
	metrics: DashboardMetrics;
}): void {
	const { workspaceId, metrics } = args;
	const actionPriorities = getActionPriorities(metrics);

	const overviewRows = [
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
		{
			section: "impact_summary",
			metric: "Avg Visibility",
			value: `${metrics.impactMetrics.avgVisibility}%`,
		},
		{
			section: "impact_summary",
			metric: "Avg Sentiment",
			value: metrics.avgSentiment.score,
		},
		{
			section: "impact_summary",
			metric: "Critical Risks",
			value: metrics.impactMetrics.criticalRiskCount,
		},
		{
			section: "impact_summary",
			metric: "Top Competitor",
			value: metrics.aggregateStats.topCompetitor,
		},
		{
			section: "impact_summary",
			metric: "Top Competitor Domain",
			value: metrics.aggregateStats.topCompetitorDomain ?? "",
		},
		{
			section: "impact_summary",
			metric: "Total Citations",
			value: metrics.totalCitations,
		},
		...actionPriorities.map((priority, index) => ({
			section: "action_priorities",
			priority: index + 1,
			action: priority,
		})),
		{
			section: "brand_perception",
			metric: "Best Known For",
			value: metrics.brandPerception.bestKnownFor ?? "",
		},
		{
			section: "brand_perception",
			metric: "Pricing Perception",
			value: metrics.brandPerception.pricingPerception,
		},
		{
			section: "brand_perception",
			metric: "Core Claims",
			value: metrics.brandPerception.coreClaims.join(" | "),
		},
		{
			section: "brand_perception",
			metric: "Differentiators",
			value: metrics.brandPerception.differentiators.join(" | "),
		},
		...metrics.competitorData
			.filter((c) => !c.isBrand)
			.map((c) => ({
				section: "competitors",
				name: c.name,
				domain: c.domain,
				appearances: c.appearances,
				visibility: c.visibility ?? "",
				avg_rank: c.avgRank ?? "",
				avg_sentiment: c.avgSentiment,
				recommendation_count: c.recCount,
			})),
		...metrics.sourcesIntelligence.map((s) => ({
			section: "citation_sources",
			domain: s.domain,
			favicon: s.favicon ?? "",
			citation_count: s.citationCount,
			unique_record_count: s.uniqueRecords.size,
			model_count: s.models.size,
			models: [...s.models].join(" | "),
			unique_records: [...s.uniqueRecords].join(" | "),
		})),
		...metrics.analyzedRecords.map((record) =>
			buildDetailedAnalysisCsvRow(record),
		),
	];

	downloadCsv(`dashboard-${workspaceId}-${Date.now()}.csv`, overviewRows);
}
