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
