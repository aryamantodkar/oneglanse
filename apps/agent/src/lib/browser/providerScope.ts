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
		// Small stagger to avoid simultaneous proxy allocation with Gemini.
		// ensureGoogleCookies() handles Google cookie establishment inline,
		// so a full 8-14s delay to "wait for Gemini" is no longer needed.
		return { minMs: 3_000, maxMs: 5_000 };
	}

	return { minMs: 1_500, maxMs: 4_500 };
}
