"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AnalysisRecord } from "@onescope/types";
import { AlertTriangle } from "lucide-react";
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

	const {
		data: analysedPromptData,
		isLoading: isAnalysedPromptsLoading,
		error: analysedPromptError,
	} = useFetchAnalysedPrompts(workspaceId);
	const {
		isLoading: isPromptSourcesLoading,
		error: promptSourcesError,
	} = usePromptSources(workspaceId);
	const isLoading = isAnalysedPromptsLoading || isPromptSourcesLoading;

	// Filters
	const [modelFilter, setModelFilter] = useState("All Models");
	const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">("all");
	const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);

	// Computed data
	const metrics = useDashboardData(analysedPromptData, modelFilter, timeFilter);

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
						Please try again in a moment. If the issue persists, check your workspace connection.
					</p>
				</div>
			</div>
		);
	}
	if (isLoading) return <DashboardSkeleton />;
	if (!analysedPromptData?.data || (Array.isArray(analysedPromptData.data) && analysedPromptData.data.length === 0)) {
		return <EmptyState />;
	}
	if (metrics.analyzedRecords.length === 0) return <NoAnalysisState />;

	return (
		<div className="ui-page-enter min-h-screen dark:bg-black">
			<div className="mx-auto w-full max-w-[95vw] px-4 py-4 sm:px-6 lg:px-8 xl:max-w-[1600px]">
				<div className="ui-stagger space-y-6">
					{/* Filters */}
					<DashboardFilters
						brandName={metrics.brandName}
						brandDomain={metrics.brandDomain}
						modelFilter={modelFilter}
						setModelFilter={setModelFilter}
						timeFilter={timeFilter}
						setTimeFilter={setTimeFilter}
					/>

					{/* Aggregate Stats */}
					<AggregateStatsRow
						presenceRate={metrics.aggregateStats.presenceRate}
						rank={metrics.avgRank.position ?? 0}
						topSource={metrics.sourcesIntelligence[0]?.domain ?? "N/A"}
						topCompetitor={metrics.aggregateStats.topCompetitor}
						topCompetitorDomain={metrics.competitorData.find(
							(c) => c.name === metrics.aggregateStats.topCompetitor && !c.isBrand
						)?.domain}
					/>

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
				</div>
			</div>
		</div>
	);
}
