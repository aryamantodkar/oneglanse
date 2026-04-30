import { downloadCsv, downloadJson } from "@/lib/export/download";
import { downloadHtmlReport } from "@/lib/export/report";
import {
	buildDetailedAnalysisCsvRow,
} from "@oneglanse/utils";
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
		brandMentioned: record.brand_analysis?.presence?.mentioned ?? null,
		recommendation: record.brand_analysis?.recommendation?.type ?? null,
		bestKnownFor: record.brand_analysis?.perception?.bestKnownFor ?? null,
		pricingPerception:
			record.brand_analysis?.perception?.pricingPerception ?? null,
		coreClaims: record.brand_analysis?.perception?.coreClaims ?? [],
		differentiators: record.brand_analysis?.perception?.differentiators ?? [],
		risks: record.brand_analysis?.risks?.items ?? [],
		competitors: record.brand_analysis?.competitors ?? [],
		citations: record.sources?.length ?? 0,
		sources: (record.sources ?? []).map((source) => ({
			title: source.title ?? "",
			url: source.url ?? "",
			domain: source.domain ?? "",
			citedText: source.cited_text ?? "",
		})),
		response: record.response ?? "",
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
			avgVisibility: metrics.impactMetrics.avgVisibility,
			criticalRiskCount: metrics.impactMetrics.criticalRiskCount,
			topSourceDomain: metrics.sourcesIntelligence[0]?.domain ?? null,
			topCompetitor: metrics.aggregateStats.topCompetitor,
		},
		actionPriorities:
			actionPriorities.length > 0
				? actionPriorities
				: ["Maintain current trajectory and scale winning prompt themes."],
		brandPerception: metrics.brandPerception,
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
				avg_rank: c.avgRank ?? "",
				avg_sentiment: c.avgSentiment,
				recommendation_count: c.recCount,
			})),
		...metrics.sourcesIntelligence.map((s) => ({
			section: "citation_sources",
			domain: s.domain,
			citation_count: s.citationCount,
		})),
		...metrics.analyzedRecords.map((record) =>
			buildDetailedAnalysisCsvRow(record),
		),
	];

	downloadCsv(`dashboard-${workspaceId}-${Date.now()}.csv`, overviewRows);
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
		.slice(0, 8)
		.map((s) => ({ label: s.domain, value: `${s.citationCount} citations` }));

	const topCompetitors = metrics.competitorData
		.filter((c) => !c.isBrand)
		.slice(0, 8)
		.map((c) => ({
			label: c.name,
			value: `${c.appearances} mention${c.appearances === 1 ? "" : "s"}`,
			sub: c.avgRank != null ? `avg rank ${c.avgRank}` : undefined,
		}));

	const topPrompts = [...metrics.analyzedRecords]
		.filter((r) => r.brand_analysis?.geoScore?.overall != null)
		.sort(
			(a, b) =>
				(b.brand_analysis?.geoScore?.overall ?? 0) -
				(a.brand_analysis?.geoScore?.overall ?? 0),
		)
		.slice(0, 8)
		.map((r) => ({
			label: r.prompt.length > 60 ? `${r.prompt.slice(0, 60)}…` : r.prompt,
			value: String(r.brand_analysis?.geoScore?.overall ?? "—"),
			sub: "GEO score",
		}));

	const perceptionRows = [
		metrics.brandPerception.bestKnownFor
			? {
					label: "Best known for",
					value: metrics.brandPerception.bestKnownFor,
				}
			: null,
		metrics.brandPerception.pricingPerception !== "not_mentioned"
			? {
					label: "Pricing perception",
					value: metrics.brandPerception.pricingPerception.replace(/_/g, " "),
				}
			: null,
		...metrics.brandPerception.coreClaims.map((c) => ({
			label: "Core claim",
			value: c,
		})),
		...metrics.brandPerception.differentiators.map((d) => ({
			label: "Differentiator",
			value: d,
		})),
	].filter((r): r is NonNullable<typeof r> => r !== null);

	const sections = [
		perceptionRows.length > 0
			? { title: "Brand Perception", rows: perceptionRows }
			: null,
		topCompetitors.length > 0
			? { title: "Top Competitors", rows: topCompetitors }
			: null,
		topSources.length > 0
			? { title: "Top Citation Sources", rows: topSources }
			: null,
		topPrompts.length > 0
			? { title: "Strongest Prompts by GEO Score", rows: topPrompts }
			: null,
	].filter((s): s is NonNullable<typeof s> => s !== null);

	const records = metrics.analyzedRecords.map((r) => {
		const ba = r.brand_analysis;
		const risks = ba?.risks?.items ?? [];
		const competitors = ba?.competitors ?? [];
		return {
			promptId: r.prompt_id,
			prompt: r.prompt,
			model: r.model_provider,
			runAt: r.prompt_run_at,
			geoScore: ba?.geoScore?.overall ?? "",
			sentiment: ba?.sentiment?.score ?? "",
			visibility: ba?.presence?.visibility ?? "",
			rank: ba?.position?.rankPosition ?? "",
			recommendation: ba?.recommendation?.type ?? "",
			mentioned: ba?.presence?.mentioned ?? "",
			riskCritical: risks.filter((x) => x.severity === "critical").length,
			riskWarning: risks.filter((x) => x.severity === "warning").length,
			riskInfo: risks.filter((x) => x.severity === "info").length,
			citationCount: r.sources?.length ?? 0,
			bestKnownFor: ba?.perception?.bestKnownFor ?? "",
			pricingPerception: ba?.perception?.pricingPerception ?? "",
			coreClaims: ba?.perception?.coreClaims?.join(" | ") ?? "",
			differentiators: ba?.perception?.differentiators?.join(" | ") ?? "",
			competitorNames: competitors.map((c) => c.name).join(" | "),
			sourceUrls: (r.sources ?? []).map((s) => s.url).join(" | "),
			sourceDomains: (r.sources ?? [])
				.map((s) => s.domain ?? "")
				.filter(Boolean)
				.join(" | "),
			response: r.response ?? "",
		};
	});

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
			{ label: "Avg Rank", value: metrics.avgRank.position ?? "—" },
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
			{ label: "Avg Sentiment", value: metrics.avgSentiment.score },
			{
				label: "Avg Visibility",
				value: metrics.impactMetrics.avgVisibility,
				suffix: "%",
			},
			{ label: "Citations", value: metrics.totalCitations },
			{
				label: "Critical Risks",
				value: metrics.impactMetrics.criticalRiskCount,
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
		records,
	});
}
