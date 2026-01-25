import { api } from "@/trpc/react";

export function useCompetitors(workspaceId: string){
    return api.competitors.fetchCompetitors.useQuery(
        { workspaceId },
        { 
          retry: 2,
          refetchOnWindowFocus: false,
          enabled: !!workspaceId, 
        }
    );
  }