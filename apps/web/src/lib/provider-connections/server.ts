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
	const [cards, statuses] = await Promise.all([
		Promise.resolve(getAuthProviderCards()),
		readProviderAuthStatuses(),
	]);
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
