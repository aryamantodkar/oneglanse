"use client";

import {
	type UseMutationOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	ProviderConnectionRequest,
	ProviderConnectionsState,
} from "./types";

const PROVIDER_CONNECTIONS_QUERY_KEY = ["provider-connections"] as const;
const PROVIDER_CONNECTIONS_POLL_INTERVAL_MS = 3_000;

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
	const response = await fetch("/api/providers", {
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
	const response = await fetch("/api/providers", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ provider, action }),
	});
	return readJson<{ started: boolean }>(response);
}

async function resetAllProviders(): Promise<{ ok: boolean }> {
	const response = await fetch("/api/providers", { method: "DELETE" });
	return readJson<{ ok: boolean }>(response);
}

export function useProviderConnections(options?: {
	initialData?: ProviderConnectionsState;
	watchForExternalUpdates?: boolean;
}) {
	return useQuery({
		queryKey: PROVIDER_CONNECTIONS_QUERY_KEY,
		queryFn: fetchProviderConnections,
		initialData: options?.initialData,
		// Always considered stale so window focus triggers a refetch immediately.
		staleTime: 0,
		// Only poll while a connection is in progress; otherwise window focus is enough.
		refetchInterval: (query) => {
			const data = query.state.data;
			if (!data) return PROVIDER_CONNECTIONS_POLL_INTERVAL_MS;
			const anyConnecting = data.cards.some((card) => card.status.connecting);
			const shouldWatchForExternalUpdates =
				options?.watchForExternalUpdates === true;
			return anyConnecting || shouldWatchForExternalUpdates
				? PROVIDER_CONNECTIONS_POLL_INTERVAL_MS
				: false;
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
				queryKey: PROVIDER_CONNECTIONS_QUERY_KEY,
			});
			await onSettled?.(...args);
		},
		...restOptions,
	});
}

export function useResetAllProviders(
	options?: Omit<
		UseMutationOptions<{ ok: boolean }, Error, void>,
		"mutationFn"
	>,
) {
	const queryClient = useQueryClient();
	const { onSettled, ...restOptions } = options ?? {};

	return useMutation({
		mutationFn: resetAllProviders,
		onSettled: async (...args) => {
			await queryClient.invalidateQueries({
				queryKey: PROVIDER_CONNECTIONS_QUERY_KEY,
			});
			await onSettled?.(...args);
		},
		...restOptions,
	});
}
