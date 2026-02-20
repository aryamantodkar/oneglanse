import type { Provider } from "@onescope/types";
import { PROVIDER_LIST } from "@onescope/types";

interface ProviderConfig {
	name: Provider;
	displayName: string;
	label: string;
	url: string;
	entryUrl: string;
	domain: string;
	description: string;
	warmupDelay: number;
}

export const PROVIDERS = {
	openai: {
		name: "openai",
		displayName: "ChatGPT",
		label: "OpenAI",
		url: "https://chatgpt.com/auth/login",
		entryUrl: "https://chatgpt.com/auth/login",
		domain: "openai.com",
		description: "ChatGPT - Powered by GPT-4",
		warmupDelay: 5000,
	},
	anthropic: {
		name: "anthropic",
		displayName: "Claude",
		label: "Anthropic",
		url: "https://claude.ai/login",
		entryUrl: "https://claude.ai/new",
		domain: "claude.ai",
		description: "Claude - Advanced reasoning and analysis",
		warmupDelay: 5000,
	},
	perplexity: {
		name: "perplexity",
		displayName: "Perplexity",
		label: "Perplexity",
		url: "https://www.perplexity.ai/",
		entryUrl: "https://www.perplexity.ai",
		domain: "perplexity.ai",
		description: "Real-time web search and citations",
		warmupDelay: 5000,
	},
	google: {
		name: "google",
		displayName: "Gemini",
		label: "Google",
		url: "https://gemini.google.com/",
		entryUrl: "https://gemini.google.com/",
		domain: "gemini.google.com",
		description: "Gemini - Google's latest AI model",
		warmupDelay: 5000,
	},
	"google-ai-overview": {
		name: "google-ai-overview",
		displayName: "AI Overview",
		label: "Google AI Overview",
		url: "https://www.google.com",
		entryUrl: "https://www.google.com",
		domain: "google.com",
		description: "AI-powered search summaries from Google",
		warmupDelay: 5000,
	},
} satisfies Record<Provider, ProviderConfig>;

export const ALL_PROVIDERS_JSON = JSON.stringify([...PROVIDER_LIST]);

/**
 * Get the user-friendly display name for a provider
 * @param provider - The provider key (openai, anthropic, perplexity, google)
 * @returns Display name (ChatGPT, Claude, Perplexity, Gemini)
 */
export function getProviderDisplayName(provider: string): string {
	const config = PROVIDERS[provider as keyof typeof PROVIDERS];
	return config?.displayName ?? provider;
}
