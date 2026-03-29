import type { Provider } from "@oneglanse/types";

export function getProviderSessionScope(provider: Provider): string {
	return provider;
}

export function getProviderStartupDelayRange(provider: Provider): {
	minMs: number;
	maxMs: number;
} {
	if (provider === "gemini") {
		return { minMs: 800, maxMs: 1_800 };
	}

	if (provider === "ai-overview") {
		return { minMs: 3_000, maxMs: 5_000 };
	}

	return { minMs: 1_500, maxMs: 4_500 };
}
