import { downloadCsv, downloadJson } from "@/lib/export/download";
import { downloadHtmlReport } from "@/lib/export/report";
import { buildAnalysisCsvRow } from "@oneglanse/utils";
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

export function exportAnalysisReport(args: {
	workspaceId: string;
	metrics: DashboardMetrics;
}): void {
	const { workspaceId, metrics } = args;

	const actions = [
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
	]
		.filter((s): s is string => s !== null)
		.map((text) => ({ text }));

	const topSources = metrics.sourcesIntelligence
		.slice(0, 5)
		.map((s) => ({ label: s.domain, value: `${s.citationCount} citations` }));

	const topCompetitors = metrics.competitorData
		.filter((c) => !c.isBrand)
		.slice(0, 5)
		.map((c) => ({
			label: c.name,
			value: `${c.appearances} mention${c.appearances === 1 ? "" : "s"}`,
		}));

	const topPrompts = [...metrics.analyzedRecords]
		.filter((r) => r.brand_analysis?.geoScore?.overall != null)
		.sort(
			(a, b) =>
				(b.brand_analysis?.geoScore?.overall ?? 0) -
				(a.brand_analysis?.geoScore?.overall ?? 0),
		)
		.slice(0, 5)
		.map((r) => ({
			label: r.prompt.length > 60 ? `${r.prompt.slice(0, 60)}…` : r.prompt,
			value: String(r.brand_analysis?.geoScore?.overall ?? "—"),
			sub: "GEO score",
		}));

	const sections = [
		topSources.length > 0
			? { title: "Top Citation Sources", rows: topSources }
			: null,
		topCompetitors.length > 0
			? { title: "Top Competitors", rows: topCompetitors }
			: null,
		topPrompts.length > 0
			? { title: "Strongest Prompts by GEO Score", rows: topPrompts }
			: null,
	].filter((s): s is NonNullable<typeof s> => s !== null);

	downloadHtmlReport(`dashboard-report-${workspaceId}-${Date.now()}.html`, {
		title: metrics.brandName || "AI Visibility Report",
		subtitle: `${metrics.brandDomain ? `${metrics.brandDomain} · ` : ""}${metrics.analyzedRecords.length} responses analyzed`,
		generatedAt: new Date().toLocaleString(),
		metrics: [
			{
				label: "Presence Rate",
				value: metrics.aggregateStats.presenceRate,
				suffix: "%",
				highlight: true,
			},
			{
				label: "Avg Rank",
				value: metrics.avgRank.position ?? "—",
			},
			{
				label: "Recommendation Rate",
				value: metrics.impactMetrics.recommendationRate,
				suffix: "%",
			},
			{
				label: "Top Pick Rate",
				value: metrics.impactMetrics.topPickRate,
				suffix: "%",
			},
			{
				label: "Avg Sentiment",
				value: metrics.avgSentiment.score,
			},
			{
				label: "Citations",
				value: metrics.totalCitations,
			},
		],
		actions:
			actions.length > 0
				? actions
				: [
						{
							text: "Maintain current trajectory and scale winning prompt themes.",
						},
					],
		sections,
	});
}
