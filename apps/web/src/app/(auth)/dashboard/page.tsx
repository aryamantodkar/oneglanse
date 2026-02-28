"use client";

import { ExportMenu } from "@/components/export-menu";
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
import { exportAnalysisCsv, exportAnalysisJson } from "./_utils/export";

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
	const metrics = useDashboardData(analysedPromptData ?? [], modelFilter, timeFilter);
	const hasAnyAnalysisInWorkspace = useMemo(() => {
		return analysedPromptData?.some((r) =>
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
							onExportJson={() =>
								exportAnalysisJson({
									workspaceId,
									metrics,
									modelFilter,
									timeFilter,
								})
							}
							onExportCsv={() =>
								exportAnalysisCsv({ workspaceId, metrics })
							}
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
