import { api } from "@/trpc/react";

export function useWorkspaceById(workspaceId: string){
    return api.workspace.getById.useQuery(
        { workspaceId },
        { 
          retry: 2,
          refetchOnWindowFocus: false,
          enabled: !!workspaceId, 
        }
    );
}