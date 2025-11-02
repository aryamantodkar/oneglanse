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

export function useStorePrompt() {
    return api.prompt.store.useMutation();
}
  
export function useAnalyzeMetrics() {
    return api.analysis.analyzeMetrics.useMutation();
}