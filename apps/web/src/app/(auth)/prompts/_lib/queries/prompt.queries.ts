import { api } from "@/trpc/react";

export function useUserPrompts(workspaceId: string){
    return api.prompt.fetchUserPrompts.useQuery(
        { workspaceId },
        { enabled: !!workspaceId }
    );
}

export function usePromptSources(workspaceId: string){
  return api.prompt.fetchPromptSources.useQuery(
      { workspaceId },
      {
        retry: 2,
        refetchOnWindowFocus: false,
        enabled: !!workspaceId,
      }
  );
}

export function useFetchAnalysedPrompts(workspaceId: string) {
    return api.analysis.fetchAnalysis.useQuery(
      { workspaceId },
      {
        enabled: !!workspaceId,
      }
    );
  }
