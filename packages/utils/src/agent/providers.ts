import type { Provider } from "@onescope/types";
import { PROVIDER_LIST } from "@onescope/types";

interface ProviderDisplayConfig {
	displayName: string;
	domain: string;
	description: string;
}

export const PROVIDER_DISPLAY = {
	openai: {
		displayName: "ChatGPT",
		domain: "openai.com",
		description: "ChatGPT - Powered by GPT-4",
	},
	anthropic: {
		displayName: "Claude",
		domain: "claude.ai",
		description: "Claude - Advanced reasoning and analysis",
	},
	perplexity: {
		displayName: "Perplexity",
		domain: "perplexity.ai",
		description: "Real-time web search and citations",
	},
	google: {
		displayName: "Gemini",
		domain: "gemini.google.com",
		description: "Gemini - Google's latest AI model",
	},
	"google-ai-overview": {
		displayName: "AI Overview",
		domain: "google.com",
		description: "AI-powered search summaries from Google",
	},
} satisfies Record<Provider, ProviderDisplayConfig>;

export const ALL_PROVIDERS_JSON = JSON.stringify([...PROVIDER_LIST]);

/**
 * Get the user-friendly display name for a provider
 * @param provider - The provider key (openai, anthropic, perplexity, google)
 * @returns Display name (ChatGPT, Claude, Perplexity, Gemini)
 */
export function getProviderDisplayName(provider: string): string {
	const config = PROVIDER_DISPLAY[provider as keyof typeof PROVIDER_DISPLAY];
	return config?.displayName ?? provider;
}
