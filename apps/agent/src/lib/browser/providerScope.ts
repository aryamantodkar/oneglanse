import type { Provider } from "@oneglanse/types";

export function getProviderSessionScope(provider: Provider): string {
	if (provider === "gemini" || provider === "ai-overview") {
		return "google";
	}

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
		// Let Gemini establish Google cookies first when both are enabled.
		return { minMs: 8_000, maxMs: 14_000 };
	}

	return { minMs: 1_500, maxMs: 4_500 };
}
