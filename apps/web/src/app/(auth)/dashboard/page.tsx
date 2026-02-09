"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, Button, Skeleton } from "@onescope/ui";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  useFetchAnalysedPrompts,
  usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";
import { BrandHealthCard } from "./_components/BrandHealthCard";
import { CompetitivePositionCard } from "./_components/CompetitivePositionCard";
import { SentimentInsightsCard } from "./_components/SentimentInsightsCard";
import { CompetitiveThreatsCard } from "./_components/CompetitiveThreatsCard";
import { StrategicOpportunitiesCard } from "./_components/StrategicOpportunitiesCard";
import { RecentInsightsCard } from "./_components/RecentInsightsCard";
import { TopSources } from "./_components/TopSources";
import {
  extractFullAnalysisData,
  calculateBrandHealthScore,
  getCompetitivePosition,
  getSentimentInsights,
  getCompetitiveThreats,
  getStrategicOpportunities,
  getRecentInsights,
  getTopDomains,
} from "./_lib/aggregations";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <Skeleton className="h-9 w-64 mb-3" />
          <Skeleton className="h-5 w-96" />
        </header>
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const {
    data: analysedPromptData,
    isLoading: isAnalysedPromptsLoading,
  } = useFetchAnalysedPrompts(workspaceId);

  const {
    data: promptSourcesData,
    isLoading: isPromptSourcesLoading,
  } = usePromptSources(workspaceId);

  const isLoading = isAnalysedPromptsLoading || isPromptSourcesLoading;

  // Aggregate data using memoization for performance
  const dashboardData = useMemo(() => {
    const records = analysedPromptData?.data?.records || [];
    const domainStats = promptSourcesData?.data?.domain_stats?.combined || [];

    // Extract full analysis data
    const fullAnalyses = extractFullAnalysisData(records);

    return {
      hasData: records.length > 0, // Show dashboard if any records exist
      hasFullAnalysis: fullAnalyses.length > 0, // Track if full analysis exists
      brandHealthScore: calculateBrandHealthScore(fullAnalyses),
      competitivePosition: getCompetitivePosition(fullAnalyses),
      sentimentInsights: getSentimentInsights(fullAnalyses),
      competitiveThreats: getCompetitiveThreats(fullAnalyses),
      strategicOpportunities: getStrategicOpportunities(fullAnalyses),
      recentInsights: getRecentInsights(fullAnalyses, 5),
      topDomains: getTopDomains(domainStats, 8),
    };
  }, [analysedPromptData, promptSourcesData]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Empty state: no analysis data yet
  if (!dashboardData.hasData) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
              Brand Intelligence
            </h1>
            <p className="text-gray-600 mt-3 text-lg">
              Get actionable insights from LLM responses
            </p>
          </header>

          <Card className="rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6">
              <div className="rounded-full bg-gray-100 p-6 mb-6">
                <Sparkles className="h-12 w-12 text-gray-700" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Get Started with Brand Intelligence
              </h3>
              <p className="text-sm text-gray-600 text-center mb-8 max-w-md leading-relaxed">
                Run your first prompt analysis to unlock insights about brand health and competitive positioning.
              </p>
              <Link href={`/prompts?workspace=${workspaceId}`}>
                <Button size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Go to Prompts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Brand Intelligence
          </h1>
          <p className="text-gray-600 mt-3 text-lg">
            AI-powered insights from LLM responses
          </p>
        </header>

        {/* Show notice if no full analysis data yet */}
        {!dashboardData.hasFullAnalysis && (
          <Card className="rounded-xl shadow-sm border-l-4 border-gray-900 mb-6">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-gray-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Enhanced Analytics Available
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Run analysis on your prompts to unlock advanced brand intelligence metrics.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Grid */}
        <div className="space-y-6">
          {/* Hero Section: Brand Health Score */}
          <BrandHealthCard score={dashboardData.brandHealthScore} />

          {/* Two Column Grid: Competitive Position + Top Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CompetitivePositionCard position={dashboardData.competitivePosition} />
            <TopSources
              topDomains={dashboardData.topDomains}
              workspaceId={workspaceId}
            />
          </div>

          {/* Two Column Grid: Sentiment + Threats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentInsightsCard insights={dashboardData.sentimentInsights} />
            <CompetitiveThreatsCard threats={dashboardData.competitiveThreats} />
          </div>

          {/* Full Width: Strategic Opportunities */}
          <StrategicOpportunitiesCard
            opportunities={dashboardData.strategicOpportunities}
          />

          {/* Full Width: Recent Insights */}
          <RecentInsightsCard insights={dashboardData.recentInsights} />
        </div>
      </div>
    </div>
  );
}
