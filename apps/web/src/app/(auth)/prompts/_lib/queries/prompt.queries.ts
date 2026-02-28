import { api } from "@/trpc/react";

export function useUserPrompts(workspaceId: string) {
	return api.prompt.fetchUserPrompts.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId,
			staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
			gcTime: 10 * 60 * 1000, // Cache for 10 minutes
			refetchOnWindowFocus: false,
		},
	);
}

export function usePromptSources(workspaceId: string) {
	return api.prompt.fetchPromptSources.useQuery(
		{ workspaceId },
		{
			retry: 2,
			enabled: !!workspaceId,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
		},
	);
}

export function useFetchAnalysedPrompts(workspaceId: string) {
	return api.analysis.fetchAnalysis.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
			refetchInterval: 60000, // Poll every 60s — users expect live analysis results
			refetchIntervalInBackground: false,
		},
	);
}
