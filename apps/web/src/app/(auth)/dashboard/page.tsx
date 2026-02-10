"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@onescope/ui";
import {
  useFetchAnalysedPrompts,
  usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";

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

  if (!workspaceId) {
    
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen">
      
    </div>
  );
}
