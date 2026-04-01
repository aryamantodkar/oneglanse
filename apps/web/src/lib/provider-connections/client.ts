"use client";

import {
	type UseMutationOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { AuthProvider, Provider, ProviderAuthStatus } from "@oneglanse/types";

export type ProviderConnectionAction = "connect" | "refresh";
export type ProviderConnectionRequest = {
	provider: AuthProvider;
	action?: ProviderConnectionAction;
};

export type ProviderConnectionCard = {
	provider: AuthProvider;
	displayName: string;
	connectLabel: string;
	domain: string;
	providers: Provider[];
	status: ProviderAuthStatus;
};

export type ProviderConnectionsState = {
	interactiveConnectAllowed: boolean;
	remoteSyncConfigured: boolean;
	cards: ProviderConnectionCard[];
};

async function readJson<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const message =
			((await response.json().catch(() => null)) as { error?: string } | null)
				?.error ?? `Request failed with status ${response.status}`;
		throw new Error(message);
	}

	return (await response.json()) as T;
}

async function fetchProviderConnections(): Promise<ProviderConnectionsState> {
	const response = await fetch("/api/provider-connections", {
		cache: "no-store",
	});
	return readJson<ProviderConnectionsState>(response);
}

async function startProviderConnection({
	provider,
	action = "connect",
}: ProviderConnectionRequest): Promise<{
	started: boolean;
}> {
	const response = await fetch("/api/provider-connections", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ provider, action }),
	});
	return readJson<{ started: boolean }>(response);
}

export function useProviderConnections() {
	return useQuery({
		queryKey: ["provider-connections"],
		queryFn: fetchProviderConnections,
		// Always considered stale so window focus triggers a refetch immediately.
		staleTime: 0,
		// Only poll while a connection is in progress; otherwise window focus is enough.
		refetchInterval: (query) => {
			const data = query.state.data;
			if (!data) return 3_000;
			const anyConnecting = data.cards.some((card) => card.status.connecting);
			return anyConnecting ? 3_000 : false;
		},
	});
}

export function useProviderConnectionAction(
	options?: Omit<
		UseMutationOptions<{ started: boolean }, Error, ProviderConnectionRequest>,
		"mutationFn"
	>,
) {
	const queryClient = useQueryClient();
	const { onSettled, ...restOptions } = options ?? {};

	return useMutation({
		mutationFn: startProviderConnection,
		onSettled: async (...args) => {
			await queryClient.invalidateQueries({
				queryKey: ["provider-connections"],
			});
			await onSettled?.(...args);
		},
		...restOptions,
	});
}
