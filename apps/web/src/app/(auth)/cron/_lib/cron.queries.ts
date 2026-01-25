import { api } from "@/trpc/react";

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