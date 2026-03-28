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
	// Fixed deterministic startup order: chatgpt → perplexity → gemini → ai-overview.
	// Overlapping random ranges caused non-deterministic ordering (e.g. perplexity
	// could start before ai-overview). Fixed values guarantee the sequence every run.
	if (provider === "chatgpt") {
		return { minMs: 0, maxMs: 0 };
	}

	if (provider === "perplexity") {
		return { minMs: 1_000, maxMs: 1_000 };
	}

	if (provider === "gemini") {
		return { minMs: 2_000, maxMs: 2_000 };
	}

	if (provider === "ai-overview") {
		// Starts after gemini has had time to establish the Google proxy hint.
		return { minMs: 4_000, maxMs: 4_000 };
	}

	return { minMs: 1_500, maxMs: 1_500 };
}
