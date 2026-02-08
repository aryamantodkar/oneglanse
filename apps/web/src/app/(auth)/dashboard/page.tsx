"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Skeleton } from "@onescope/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import {
  useUserPrompts,
  useFetchAnalysedPrompts,
  usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";
import { OverviewStats } from "./_components/OverviewStats";
import { RecentActivity } from "./_components/RecentActivity";
import { BrandPerformance } from "./_components/BrandPerformance";
import { ModelDistribution } from "./_components/ModelDistribution";
import { TopSources } from "./_components/TopSources";
import { AnalysisStatus } from "./_components/AnalysisStatus";
import {
  aggregateBrandMetrics,
  aggregateModelStats,
  getRecentPrompts,
  calculateAnalysisStatus,
  getTopDomains,
} from "./_lib/aggregations";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-96" />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const {
    data: userPrompts,
    isLoading: isUserPromptsLoading,
  } = useUserPrompts(workspaceId);

  const {
    data: analysedPromptData,
    isLoading: isAnalysedPromptsLoading,
  } = useFetchAnalysedPrompts(workspaceId);

  const {
    data: promptSourcesData,
    isLoading: isPromptSourcesLoading,
  } = usePromptSources(workspaceId);

  const isLoading =
    isUserPromptsLoading || isAnalysedPromptsLoading || isPromptSourcesLoading;

  // Aggregate data using memoization for performance
  const aggregatedData = useMemo(() => {
    const prompts = userPrompts?.data || [];
    const records = analysedPromptData?.data?.records || [];
    const metadata = analysedPromptData?.data?.metadata || { available_brands: [] };
    const domainStats = promptSourcesData?.data?.domain_stats?.combined || [];

    return {
      totalPrompts: prompts.length,
      totalResponses: records.length,
      trackedBrands: metadata.available_brands.length,
      uniqueSources: domainStats.length,
      brandSummaries: aggregateBrandMetrics(records),
      modelStats: aggregateModelStats(records),
      recentPrompts: getRecentPrompts(prompts, records, 5),
      analysisStatus: calculateAnalysisStatus(records),
      topDomains: getTopDomains(domainStats, 8),
    };
  }, [userPrompts, analysedPromptData, promptSourcesData]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Empty state: no prompts created yet
  if (aggregatedData.totalPrompts === 0) {
    return (
      <div className="min-h-screen p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-2">
            Welcome back! Here's a quick overview of your workspace.
          </p>
        </header>
        <Card className="rounded-xl shadow-sm max-w-2xl mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Get Started with OneScope
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6 max-w-md">
              Create your first prompt to start monitoring brand mentions across
              ChatGPT, Claude, and Perplexity.
            </p>
            <Link href={`/prompts?workspace=${workspaceId}`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Prompt
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Welcome back! Here's a quick overview of your workspace.
        </p>
      </header>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section 1 & 2: Overview Stats + Recent Activity */}
        <div className="lg:col-span-1">
          <OverviewStats
            totalPrompts={aggregatedData.totalPrompts}
            totalResponses={aggregatedData.totalResponses}
            trackedBrands={aggregatedData.trackedBrands}
            uniqueSources={aggregatedData.uniqueSources}
          />
        </div>

        <div className="lg:col-span-2">
          <RecentActivity
            recentPrompts={aggregatedData.recentPrompts}
            workspaceId={workspaceId}
          />
        </div>

        {/* Section 3: Brand Performance (Full Width) */}
        <BrandPerformance brandSummaries={aggregatedData.brandSummaries} />

        {/* Section 4, 5, 6: Bottom Row */}
        <ModelDistribution modelStats={aggregatedData.modelStats} />

        <TopSources
          topDomains={aggregatedData.topDomains}
          workspaceId={workspaceId}
        />

        <AnalysisStatus status={aggregatedData.analysisStatus} />
      </div>
    </div>
  );
}