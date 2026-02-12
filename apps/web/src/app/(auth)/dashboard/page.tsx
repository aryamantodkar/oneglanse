"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalysisRecord } from "@onescope/types";
import {
	useFetchAnalysedPrompts,
	usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";

// Components
import { DashboardFilters } from "./_components/filters";
import { AggregateStatsRow } from "./_components/stats-row";
import { CompetitiveLandscape } from "./_components/competitive-landscape";
import { TopSources } from "./_components/top-sources";
import { BrandPerceptionCard } from "./_components/brand-perception";
import {
	DashboardSkeleton,
	NoWorkspaceState,
	EmptyState,
	NoAnalysisState,
} from "./_components/states";

// Hooks
import { useDashboardData } from "./_hooks/use-dashboard-data";

export default function Dashboard() {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const { data: analysedPromptData, isLoading: isAnalysedPromptsLoading } =
		useFetchAnalysedPrompts(workspaceId);
	const { isLoading: isPromptSourcesLoading } = usePromptSources(workspaceId);
	const isLoading = isAnalysedPromptsLoading || isPromptSourcesLoading;

	// Filters
	const [modelFilter, setModelFilter] = useState("All Models");
	const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">("all");
	const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);

	// Computed data
	const metrics = useDashboardData(analysedPromptData, modelFilter, timeFilter);

	// Conditional renders
	if (!workspaceId) return <NoWorkspaceState />;
	if (isLoading) return <DashboardSkeleton />;
	if (!analysedPromptData?.data || (Array.isArray(analysedPromptData.data) && analysedPromptData.data.length === 0)) {
		return <EmptyState />;
	}
	if (metrics.analyzedRecords.length === 0) return <NoAnalysisState />;

	return (
		<div className="min-h-screen dark:bg-black">
			<div className="mx-auto w-full max-w-[95vw] xl:max-w-[1600px] space-y-6 px-4 py-4 sm:px-6 lg:px-8">
				{/* Filters */}
				<DashboardFilters
					modelFilter={modelFilter}
					setModelFilter={setModelFilter}
					timeFilter={timeFilter}
					setTimeFilter={setTimeFilter}
				/>

				{/* Aggregate Stats */}
				<AggregateStatsRow
					presenceRate={metrics.aggregateStats.presenceRate}
					rank={metrics.avgRank.position ?? 0}
					topSource={metrics.sourcesIntelligence[0]?.domain ?? 'N/A'}
					topCompetitor={metrics.aggregateStats.topCompetitor}
					topCompetitorDomain={metrics.competitorData.find(
						(c) => c.name === metrics.aggregateStats.topCompetitor && !c.isBrand
					)?.domain}
				/>

				{/* 3-Column Grid */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					<CompetitiveLandscape
						competitors={metrics.competitorData}
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
			</div>
		</div>
	);
}
