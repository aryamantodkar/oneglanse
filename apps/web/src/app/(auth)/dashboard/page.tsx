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
	type PromptGroup,
	PromptResponsesList,
	TopSources,
} from "@oneglanse/ui";
import { filterAnalysisRecords } from "@oneglanse/utils";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
	useFetchAnalysedPrompts,
	usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";

// Components
import { DashboardFilters } from "./_components/filters";
import {
	DashboardSkeleton,
	EmptyState,
	FilteredDashboardState,
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
	const hasCompetitorRows = useMemo(
		() => metrics.competitorData.some((competitor) => !competitor.isBrand),
		[metrics.competitorData],
	);
	const hasSourceRows = metrics.sourcesIntelligence.length > 0;
	const hasBrandPerceptionData =
		Boolean(metrics.brandPerception.bestKnownFor) ||
		metrics.brandPerception.pricingPerception !== "not_mentioned" ||
		metrics.brandPerception.coreClaims.length > 0 ||
		metrics.brandPerception.differentiators.length > 0;
	const insightCardCount =
		Number(hasSourceRows) + Number(hasBrandPerceptionData);

	// Build prompt groups for the responses list section
	const promptGroups = useMemo((): PromptGroup[] => {
		if (!analysedPromptData) return [];
		const filtered = filterAnalysisRecords(analysedPromptData, {
			modelFilter,
			timeFilter,
		});
		const groupMap = new Map<
			string,
			{ promptText: string; rows: AnalysisRecord[] }
		>();
		for (const record of filtered) {
			const existing = groupMap.get(record.prompt_id);
			if (existing) {
				existing.rows.push(record);
			} else {
				groupMap.set(record.prompt_id, {
					promptText: record.prompt,
					rows: [record],
				});
			}
		}
		return Array.from(groupMap.entries()).map(
			([promptId, { promptText, rows }]) => ({
				promptId,
				promptText,
				rows: rows.map((r) => ({
					id: r.id,
					modelProvider: r.model_provider,
					promptRunAt: r.prompt_run_at,
					response: r.response,
					isAnalysed: r.is_analysed ?? false,
					sources: r.sources.map((s) => ({ title: s.title, url: s.url })),
					metrics:
						r.is_analysed && r.brand_analysis
							? {
									geoScore: r.brand_analysis.geoScore.overall,
									sentiment: r.brand_analysis.sentiment.score,
									visibility: r.brand_analysis.presence.visibility,
									position: r.brand_analysis.position.rankPosition,
								}
							: undefined,
				})),
			}),
		);
	}, [analysedPromptData, modelFilter, timeFilter]);

	// Conditional renders
	if (!workspaceId) return <NoWorkspaceState />;
	if (analysedPromptError || promptSourcesError) {
		return (
			<div className="web-centered-state">
				<div className="web-empty-state">
					<div className="web-empty-state-icon border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
					</div>
					<h2 className="text-base font-semibold text-gray-900 sm:text-lg dark:text-gray-100">
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

					{!hasFilteredAnalysis ? (
						<FilteredDashboardState
							workspaceId={workspaceId}
							modelFilter={modelFilter}
						/>
					) : (
						<>
							<AggregateStatsRow
								presenceRate={metrics.aggregateStats.presenceRate}
								rank={metrics.avgRank.position ?? 0}
								topSource={metrics.sourcesIntelligence[0]?.domain ?? "N/A"}
								topCompetitor={metrics.aggregateStats.topCompetitor}
								topCompetitorDomain={
									metrics.competitorData.find(
										(c) =>
											c.name === metrics.aggregateStats.topCompetitor &&
											!c.isBrand,
									)?.domain
								}
							/>

							<div className="space-y-4 sm:space-y-5">
								{hasCompetitorRows ? (
									<CompetitiveLandscape competitors={metrics.competitorData} />
								) : null}

								{insightCardCount > 0 ? (
									<div
										className={`grid grid-cols-1 items-stretch gap-4 ${
											insightCardCount > 1 ? "lg:grid-cols-2" : "lg:grid-cols-1"
										}`}
									>
										{hasSourceRows ? (
											<TopSources
												sources={metrics.sourcesIntelligence}
												totalCitations={metrics.totalCitations}
											/>
										) : null}
										{hasBrandPerceptionData ? (
											<BrandPerceptionCard
												bestKnownFor={metrics.brandPerception.bestKnownFor}
												pricingPerception={
													metrics.brandPerception.pricingPerception
												}
												coreClaims={metrics.brandPerception.coreClaims}
												differentiators={
													metrics.brandPerception.differentiators
												}
											/>
										) : null}
									</div>
								) : null}

								<BrandComparisonChart
									competitors={metrics.competitorData}
									brandName={metrics.brandName}
									totalResponses={metrics.impactMetrics.totalResponses}
									brandPresenceRate={metrics.aggregateStats.presenceRate}
									brandRecommendationRate={
										metrics.impactMetrics.recommendationRate
									}
									brandSentimentScore={metrics.avgSentiment.score}
									brandAvgRank={metrics.avgRank.position}
								/>
							</div>

							{promptGroups.length > 0 ? (
								<PromptResponsesList groups={promptGroups} />
							) : null}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
