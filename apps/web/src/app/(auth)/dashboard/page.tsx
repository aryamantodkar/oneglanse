"use client";

import { ExportMenu } from "@/components/export-menu";
import { downloadCsv, downloadJson } from "@/lib/export/download";
import type { AnalysisRecord } from "@oneglanse/types";
import { AlertTriangle, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
	useFetchAnalysedPrompts,
	usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";

import { BrandComparisonChart } from "./_components/brand-comparison-chart";
import { BrandPerceptionCard } from "./_components/brand-perception";
import { CompetitiveLandscape } from "./_components/competitive-landscape";
// Components
import { DashboardFilters } from "./_components/filters";
import {
	DashboardSkeleton,
	EmptyState,
	NoAnalysisState,
	NoWorkspaceState,
} from "./_components/states";
import { AggregateStatsRow } from "./_components/stats-row";
import { TopSources } from "./_components/top-sources";

// Hooks
import { useDashboardData } from "./_hooks/use-dashboard-data";

export default function Dashboard(): React.JSX.Element {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const {
		data: analysedPromptData,
		isLoading: isAnalysedPromptsLoading,
		error: analysedPromptError,
	} = useFetchAnalysedPrompts(workspaceId);
	const { isLoading: isPromptSourcesLoading, error: promptSourcesError } =
		usePromptSources(workspaceId);
	const isLoading = isAnalysedPromptsLoading || isPromptSourcesLoading;

	// Filters
	const [modelFilter, setModelFilter] = useState("All Models");
	const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">(
		"all",
	);
	const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(
		null,
	);

	// Computed data
	const metrics = useDashboardData(analysedPromptData, modelFilter, timeFilter);
	const hasAnyAnalysisInWorkspace = useMemo(() => {
		const data = analysedPromptData;
		if (!data) return false;

		const records = Array.isArray(data)
			? data
			: typeof data === "object" &&
					data &&
					"records" in data &&
					Array.isArray((data as any).records)
				? (data as any).records
				: [];

		return records.some((r: any) =>
			Boolean(r?.is_analysed && r?.brand_analysis),
		);
	}, [analysedPromptData]);
	const hasFilteredAnalysis = metrics.analyzedRecords.length > 0;

	// Conditional renders
	if (!workspaceId) return <NoWorkspaceState />;
	if (analysedPromptError || promptSourcesError) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="flex flex-col items-center px-6 text-center">
					<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
						<AlertTriangle className="h-6 w-6 text-amber-500" />
					</div>
					<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
						We couldn&apos;t load your dashboard
					</h2>
					<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
						Please try again in a moment. If the issue persists, check your
						workspace connection.
					</p>
				</div>
			</div>
		);
	}
	if (isLoading) return <DashboardSkeleton />;
	if (
		!analysedPromptData ||
		(Array.isArray(analysedPromptData) &&
			analysedPromptData.length === 0)
	) {
		return <EmptyState />;
	}
	if (!hasAnyAnalysisInWorkspace) return <NoAnalysisState />;

	return (
		<div className="ui-page-enter min-h-screen dark:bg-black">
			<div className="mx-auto w-full max-w-[95vw] px-4 pt-4 pb-12 sm:px-6 lg:px-8 xl:max-w-[1600px]">
				<div className="ui-stagger space-y-6">
					{/* Filters */}
					<div className="flex items-center justify-between gap-3">
						<DashboardFilters
							brandName={metrics.brandName}
							brandDomain={metrics.brandDomain}
							modelFilter={modelFilter}
							setModelFilter={setModelFilter}
							timeFilter={timeFilter}
							setTimeFilter={setTimeFilter}
						/>
						<ExportMenu
							disabled={!hasFilteredAnalysis}
							onExportJson={() => {
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
									visibility:
										record.brand_analysis?.presence?.visibility ?? null,
									position:
										record.brand_analysis?.position?.rankPosition ?? null,
									recommendation:
										record.brand_analysis?.recommendation?.type ?? null,
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
										topSourceDomain:
											metrics.sourcesIntelligence[0]?.domain ?? null,
										topCompetitor: metrics.aggregateStats.topCompetitor,
									},
									actionPriorities:
										actionPriorities.length > 0
											? actionPriorities
											: [
													"Maintain current trajectory and scale winning prompt themes.",
												],
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
							}}
							onExportCsv={() => {
								const rows = [
									{
										section: "overview",
										metric: "Brand",
										value: metrics.brandName,
									},
									{
										section: "overview",
										metric: "Domain",
										value: metrics.brandDomain,
									},
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
									...metrics.analyzedRecords.map((record) => ({
										section: "prompt_details",
										prompt: record.prompt,
										model: record.model_provider,
										prompt_run_at: record.prompt_run_at,
										geo_score: record.brand_analysis?.geoScore?.overall ?? "",
										sentiment: record.brand_analysis?.sentiment?.score ?? "",
										visibility:
											record.brand_analysis?.presence?.visibility ?? "",
										position:
											record.brand_analysis?.position?.rankPosition ?? "",
										recommendation:
											record.brand_analysis?.recommendation?.type ?? "",
										citations: record.sources?.length ?? 0,
										source_urls: (record.sources ?? [])
											.map((source) => source.url)
											.filter(Boolean)
											.join(" | "),
										cited_texts: (record.sources ?? [])
											.map((source) => source.cited_text)
											.filter(Boolean)
											.join(" | "),
									})),
								];
								downloadCsv(`dashboard-${workspaceId}-${Date.now()}.csv`, rows);
							}}
						/>
					</div>

					{/* Aggregate Stats */}
					<AggregateStatsRow
						presenceRate={metrics.aggregateStats.presenceRate}
						rank={metrics.avgRank.position ?? 0}
						topSource={metrics.sourcesIntelligence[0]?.domain ?? "N/A"}
						topCompetitor={metrics.aggregateStats.topCompetitor}
						topCompetitorDomain={
							metrics.competitorData.find(
								(c) =>
									c.name === metrics.aggregateStats.topCompetitor && !c.isBrand,
							)?.domain
						}
						noData={!hasFilteredAnalysis}
					/>

					{!hasFilteredAnalysis && (
						<div className="flex items-start gap-2 rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50 to-white px-4 py-3 text-sm text-muted-foreground dark:border-gray-800 dark:from-gray-900/70 dark:to-gray-900">
							<Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
							<span>
								No analysis data for this filter selection. Try another model or
								time range.
							</span>
						</div>
					)}

					{/* 3-Column Grid */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
						<CompetitiveLandscape
							competitors={metrics.competitorData}
							modelFilter={modelFilter}
						/>
						<TopSources
							sources={metrics.sourcesIntelligence}
							totalCitations={metrics.totalCitations}
						/>
						<BrandPerceptionCard
							bestKnownFor={metrics.brandPerception.bestKnownFor}
							pricingPerception={metrics.brandPerception.pricingPerception}
							coreClaims={metrics.brandPerception.coreClaims}
							differentiators={metrics.brandPerception.differentiators}
						/>
					</div>

					<div className="space-y-4">
						<BrandComparisonChart
							competitors={metrics.competitorData}
							brandName={metrics.brandName}
							brandDomain={metrics.brandDomain}
							totalResponses={metrics.impactMetrics.totalResponses}
							brandPresenceRate={metrics.aggregateStats.presenceRate}
							brandRecommendationRate={metrics.impactMetrics.recommendationRate}
							brandSentimentScore={metrics.avgSentiment.score}
							brandAvgRank={metrics.avgRank.position}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
