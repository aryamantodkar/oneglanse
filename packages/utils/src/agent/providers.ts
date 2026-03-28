import type { Provider } from "@oneglanse/types";
import { PROVIDER_LIST } from "@oneglanse/types";

interface ProviderDisplayConfig {
	displayName: string;
	domain: string;
	description: string;
}

export const PROVIDER_DISPLAY = {
	chatgpt: {
		displayName: "ChatGPT",
		domain: "openai.com",
		description: "ChatGPT - Powered by GPT-4",
	},
	perplexity: {
		displayName: "Perplexity",
		domain: "perplexity.ai",
		description: "Real-time web search and citations",
	},
	gemini: {
		displayName: "Gemini",
		domain: "gemini.google.com",
		description: "Gemini - Latest AI model",
	},
	"ai-overview": {
		displayName: "AI Overview",
		domain: "google.com",
		description: "AI-powered search summaries",
	},
} satisfies Record<Provider, ProviderDisplayConfig>;

export const ALL_PROVIDERS_JSON = JSON.stringify([...PROVIDER_LIST]);

/**
 * Get the user-friendly display name for a provider
 * @param provider - The provider key (chatgpt, perplexity, gemini, ai-overview)
 * @returns Display name (ChatGPT, Claude, Perplexity, Gemini)
 */
export function getProviderDisplayName(provider: string): string {
	const config = PROVIDER_DISPLAY[provider as keyof typeof PROVIDER_DISPLAY];
	return config?.displayName ?? provider;
}
