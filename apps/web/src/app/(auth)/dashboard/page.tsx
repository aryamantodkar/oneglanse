"use client";

import { ExportMenu } from "@/components/export-menu";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type { AnalysisRecord } from "@oneglanse/types";
import {
	AggregateStatsRow,
	BrandComparisonChart,
	BrandPerceptionCard,
	CompetitiveLandscape,
	TopSources,
} from "@oneglanse/ui";
import { AlertTriangle, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
	useFetchAnalysedPrompts,
	usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";

// Components
import { DashboardFilters } from "./_components/filters";
import {
	DashboardSkeleton,
	EmptyState,
	NoAnalysisState,
	NoWorkspaceState,
} from "./_components/states";
import { exportAnalysisCsv, exportAnalysisJson } from "./_utils/export";

// Hooks
import { useDashboardData } from "./_hooks/use-dashboard-data";

export default function Dashboard() {
	const router = useRouter();
	const searchParams = useSafeSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const {
		data: analysedPromptData,
		isLoading: isAnalysedPromptsLoading,
		error: analysedPromptError,
	} = useFetchAnalysedPrompts(workspaceId);
	const { data: workspace } = api.workspace.getById.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const { isLoading: isPromptSourcesLoading, error: promptSourcesError } =
		usePromptSources(workspaceId);
	const isLoading = isAnalysedPromptsLoading || isPromptSourcesLoading;

	// Filters — persisted in URL so they survive navigation and are bookmarkable
	const modelFilter = searchParams.get("model") ?? "All Models";
	const timeFilter = (searchParams.get("time") ?? "all") as
		| "all"
		| "7d"
		| "14d"
		| "30d";

	const setModelFilter = (value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("model", value);
		router.push(`?${params.toString()}`, { scroll: false });
	};

	const setTimeFilter = (value: "all" | "7d" | "14d" | "30d") => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("time", value);
		router.push(`?${params.toString()}`, { scroll: false });
	};

	const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(
		null,
	);
	void selectedRecord;
	void setSelectedRecord;

	// Computed data
	const metrics = useDashboardData(
		analysedPromptData ?? [],
		modelFilter,
		timeFilter,
		{
			name: workspace?.name,
			domain: workspace?.domain,
		},
	);
	const hasAnyAnalysisInWorkspace = useMemo(() => {
		return analysedPromptData?.some((r) =>
			Boolean(r?.is_analysed && r?.brand_analysis),
		);
	}, [analysedPromptData]);
	const hasFilteredAnalysis = metrics.analyzedRecords.length > 0;
	const hasExportableData = hasFilteredAnalysis;

	// Conditional renders
	if (!workspaceId) return <NoWorkspaceState />;
	if (analysedPromptError || promptSourcesError) {
		return (
			<div className="web-centered-state">
				<div className="web-empty-state">
					<div className="web-empty-state-icon border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
					</div>
					<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
						We couldn&apos;t load your dashboard
					</h2>
					<p className="mt-2 text-gray-500 text-sm dark:text-gray-400">
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
		(Array.isArray(analysedPromptData) && analysedPromptData.length === 0)
	) {
		return <EmptyState workspaceId={workspaceId} />;
	}
	if (!hasAnyAnalysisInWorkspace)
		return <NoAnalysisState workspaceId={workspaceId} />;

	return (
		<div className="web-page-wide">
			<div className="web-page-wide-inner">
				<div className="ui-stagger space-y-5 sm:space-y-6">
					{/* Filters */}
					<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
						<DashboardFilters
							brandName={metrics.brandName}
							brandDomain={metrics.brandDomain}
							modelFilter={modelFilter}
							setModelFilter={setModelFilter}
							timeFilter={timeFilter}
							setTimeFilter={setTimeFilter}
						/>
						<ExportMenu
							className="w-full sm:w-auto"
							disabled={!hasExportableData}
							onExportJson={() =>
								exportAnalysisJson({
									workspaceId,
									metrics,
									modelFilter,
									timeFilter,
								})
							}
							onExportCsv={() => exportAnalysisCsv({ workspaceId, metrics })}
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
						<div className="flex items-start gap-2 rounded-[24px] border border-gray-100/80 bg-white px-4 py-4 text-sm text-muted-foreground shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)]">
							<Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
							<span>
								No analysis data for this filter selection. Try another model or
								time range.
							</span>
						</div>
					)}

					<div className="space-y-4 sm:space-y-5">
						<CompetitiveLandscape competitors={metrics.competitorData} />

						<div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
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
