import {
	getAuthModuleState,
	getAuthProviderCards,
	readProviderAuthStatuses,
} from "@oneglanse/services";
import type { AuthProvider, ProviderAuthStatus } from "@oneglanse/types";
import type { ProviderConnectionsState } from "./types";

function getDefaultProviderAuthStatus(
	provider: AuthProvider,
): ProviderAuthStatus {
	return {
		provider,
		connected: false,
		connecting: false,
		synced: false,
		lastUpdatedAt: null,
		syncedAt: null,
		error: null,
	};
}

export async function readProviderConnectionsState(): Promise<ProviderConnectionsState> {
	const cards = getAuthProviderCards();
	let statuses: ProviderAuthStatus[];

	try {
		statuses = await readProviderAuthStatuses();
	} catch (error) {
		const message =
			error instanceof Error
				? "Auth storage is unavailable on this server. You can still use the app, but provider sessions cannot be read until auth storage is mounted."
				: "Auth storage is unavailable on this server.";

		statuses = cards.map((card) => ({
			...getDefaultProviderAuthStatus(card.provider),
			error: message,
		}));
	}

	const statusMap = new Map(
		statuses.map((status) => [status.provider, status] as const),
	);

	return {
		...getAuthModuleState(),
		cards: cards.map((card) => ({
			...card,
			status: statusMap.get(card.provider) ?? getDefaultProviderAuthStatus(card.provider),
		})),
	};
}
