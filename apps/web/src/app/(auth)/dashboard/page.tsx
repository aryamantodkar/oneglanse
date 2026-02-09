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
import { CompetitivePositionCard } from "./_components/CompetitivePositionCard";
import { SentimentInsightsCard } from "./_components/SentimentInsightsCard";
import { CompetitiveThreatsCard } from "./_components/CompetitiveThreatsCard";
import { StrategicOpportunitiesCard } from "./_components/StrategicOpportunitiesCard";
import { TopSources } from "./_components/TopSources";
import {
  extractFullAnalysisData,
  getCompetitivePosition,
  getSentimentInsights,
  getCompetitiveThreats,
  getStrategicOpportunities,
  getTopDomains,
} from "./_lib/aggregations";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-3 w-64" />
        </header>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
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
      competitivePosition: getCompetitivePosition(fullAnalyses),
      sentimentInsights: getSentimentInsights(fullAnalyses),
      competitiveThreats: getCompetitiveThreats(fullAnalyses),
      strategicOpportunities: getStrategicOpportunities(fullAnalyses),
      topDomains: getTopDomains(domainStats, 8),
    };
  }, [analysedPromptData, promptSourcesData]);

  // Show message if no workspace in URL
  if (!workspaceId) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <header className="mb-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Brand Intelligence
            </h1>
            <p className="text-gray-500 mt-1 text-xs">
              AI-powered insights from LLM responses
            </p>
          </header>

          <Card className="rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-gray-700" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                No Workspace Selected
              </h3>
              <p className="text-xs text-gray-600 text-center mb-6 max-w-md leading-relaxed">
                Please navigate to the dashboard from the sidebar to select a workspace.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Empty state: no analysis data yet
  if (!dashboardData.hasData) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <header className="mb-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Brand Intelligence
            </h1>
            <p className="text-gray-500 mt-1 text-xs">
              Get actionable insights from LLM responses
            </p>
          </header>

          <Card className="rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-gray-700" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                Get Started with Brand Intelligence
              </h3>
              <p className="text-xs text-gray-600 text-center mb-6 max-w-md leading-relaxed">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Brand Intelligence
          </h1>
          <p className="text-gray-500 mt-1 text-xs">
            AI-powered insights from LLM responses
          </p>
        </header>

        {/* Show notice if no full analysis data yet */}
        {!dashboardData.hasFullAnalysis && (
          <Card className="rounded-xl shadow-sm border-l-2 border-gray-900 mb-4">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-gray-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    Enhanced Analytics Available
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Run analysis on your prompts to unlock advanced brand intelligence metrics.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Grid - Compact 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Column 1 */}
          <CompetitivePositionCard position={dashboardData.competitivePosition} />

          {/* Column 2 */}
          <TopSources
            topDomains={dashboardData.topDomains}
            workspaceId={workspaceId}
          />

          {/* Column 3 */}
          <SentimentInsightsCard insights={dashboardData.sentimentInsights} />
        </div>

        {/* Second Row - 2 Column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <CompetitiveThreatsCard threats={dashboardData.competitiveThreats} />
          <StrategicOpportunitiesCard
            opportunities={dashboardData.strategicOpportunities}
          />
        </div>
      </div>
    </div>
  );
}
