import { api } from "@/trpc/react";

export function fetchUserPrompts(workspaceId: string){
    return api.prompt.fetchUserPrompts.useQuery(
        { workspaceId },
        { enabled: !!workspaceId }
    );
}

export function fetchPromptResponses(workspaceId: string){
    return api.prompt.fetchPromptResponses.useQuery(
        { workspaceId },
        { 
          retry: 2,
          refetchOnWindowFocus: false,
          enabled: !!workspaceId, 
        }
    );
}

export function useFailedJobs(workspaceId: string) {
    return api.cron.fetchFailedJobs.useQuery(
      { workspaceId },
      {
        refetchInterval: 300_000, // default 5 minutes
        refetchOnWindowFocus: true,
        enabled: !!workspaceId,
        staleTime: 120_000, // consider data fresh for 2 min
      }
    );
}

export function getWorkspaceByIdMutation(workspaceId: string){
    return api.workspace.getById.useQuery(
        { workspaceId },
        { 
          retry: 2,
          refetchOnWindowFocus: false,
          enabled: !!workspaceId, 
        }
    );
}

export function useStorePrompt() {
    return api.prompt.store.useMutation();
}
  
export function useAnalyzeMetrics() {
    return api.analysis.analyzeMetrics.useMutation();
}

export function useFetchAnalysedPrompts(workspaceId: string) {
    return api.analysis.fetchAnalysis.useQuery(
      { workspaceId },
      {
        enabled: !!workspaceId,
      }
    );
  }

  
export function useAnalyzeCompetitors() {
    return api.competitors.analyseCompetitors.useMutation();
}

export function getCompetitorsForWorkspace(workspaceId: string){
  return api.competitors.fetchCompetitors.useQuery(
      { workspaceId },
      { 
        retry: 2,
        refetchOnWindowFocus: false,
        enabled: !!workspaceId, 
      }
  );
}