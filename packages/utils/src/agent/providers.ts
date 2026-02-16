export const PROVIDERS = {
    openai: {
      name: "openai",
      displayName: "ChatGPT",
      url: "https://chatgpt.com/auth/login"
    },
    anthropic: {
      name: "anthropic",
      displayName: "Claude",
      url: "https://claude.ai/login"
    },
    perplexity: {
      name: "perplexity",
      displayName: "Perplexity",
      url: "https://www.perplexity.ai/"
    },
    google: {
      name: "google",
      displayName: "Gemini",
      url: "https://gemini.google.com/"
    },
    "google-ai-overview": {
      name: "google-ai-overview",
      displayName: "AI Overview",
      url: "https://www.google.com/search"
    },
};

/**
 * Get the user-friendly display name for a provider
 * @param provider - The provider key (openai, anthropic, perplexity, google)
 * @returns Display name (ChatGPT, Claude, Perplexity, Gemini)
 */
export function getProviderDisplayName(provider: string): string {
    const providerConfig = PROVIDERS[provider as keyof typeof PROVIDERS];
    return providerConfig?.displayName ?? provider;
}