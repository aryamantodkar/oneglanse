import { api } from "@/trpc/react";

export function useUserPrompts(workspaceId: string) {
	return api.prompt.fetchUserPrompts.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId,
			refetchOnWindowFocus: true, // Refetch when user returns to tab
			staleTime: 30000, // Consider data fresh for 30 seconds
		},
	);
}

export function usePromptSources(workspaceId: string) {
	return api.prompt.fetchPromptSources.useQuery(
		{ workspaceId },
		{
			retry: 2,
			refetchOnWindowFocus: false,
			enabled: !!workspaceId,
		},
	);
}

export function useFetchAnalysedPrompts(workspaceId: string) {
	return api.analysis.fetchAnalysis.useQuery(
		{ workspaceId },
		{
			enabled: !!workspaceId,
			refetchOnWindowFocus: true, // Refetch when user returns to tab
			staleTime: 30000, // Consider data fresh for 30 seconds
			refetchInterval: 60000, // Light polling every 60 seconds only
		},
	);
}
