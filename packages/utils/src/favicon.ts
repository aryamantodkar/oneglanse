import { getDomain } from "./url/getDomain.js";
import { PROVIDER_DISPLAY } from "./agent/providers.js";

export const getModelFavicon = (model: string): string => {
	// Normalize model name to lowercase provider key
	const normalizedModel = model.toLowerCase();

	// If "All Models", return empty string (we'll use Bot icon instead)
	if (model === "All Models") return "";

	// Check known provider keys first (chatgpt, perplexity, gemini)
	const providerConfig =
		PROVIDER_DISPLAY[normalizedModel as keyof typeof PROVIDER_DISPLAY];
	if (providerConfig) {
		return `https://www.google.com/s2/favicons?sz=32&domain=${providerConfig.domain}`;
	}

	// Fallback: display name aliases and other models
	const fallbackDomains: Record<string, string> = {
		chatgpt: "openai.com",
		gemini: "gemini.google.com",
		"ai-overview": "google.com",
		claude: "claude.ai",
		mistral: "mistral.ai",
		meta: "about.fb.com",
		cohere: "cohere.com",
	};

	const domain = fallbackDomains[normalizedModel] ?? `${normalizedModel}.com`;
	return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
};

export const getFaviconUrls = (domain?: string, name?: string): string[] => {
	const hostname = getDomain(domain ?? "");

	if (!hostname) return [];

	return [
		// Google favicon (most reliable)
		`https://www.google.com/s2/favicons?sz=64&domain=${hostname}`,

		// DuckDuckGo favicon
		`https://icons.duckduckgo.com/ip3/${hostname}.ico`,

		// Clearbit logo
		`https://logo.clearbit.com/${hostname}`,
	].filter(Boolean);
};
