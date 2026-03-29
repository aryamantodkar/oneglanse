import type { Provider } from "@oneglanse/types";

export function getProviderSessionScope(provider: Provider): string {
	if (provider === "gemini" || provider === "ai-overview") {
		return "google";
	}

	return provider;
}
