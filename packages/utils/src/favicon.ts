import { getDomain } from "./url/getDomain.js";

export const getModelFavicon = (model: string): string => {
    // Normalize model name to lowercase provider key
    const normalizedModel = model.toLowerCase();

    const modelDomains: Record<string, string> = {
      // Provider keys (lowercase)
      openai: "openai.com",
      anthropic: "claude.ai",
      perplexity: "perplexity.ai",
      google: "gemini.google.com",
      "google-ai-overview": "google.com",
      mistral: "mistral.ai",
      meta: "about.fb.com",
      cohere: "cohere.com",

      // Display names (for backward compatibility)
      chatgpt: "openai.com",
      claude: "claude.ai",
      gemini: "gemini.google.com",
    };

    // If "All Models", return empty string (we'll use Bot icon instead)
    if (model === "All Models") return "";

    const domain = modelDomains[normalizedModel] || `${normalizedModel}.com`;
    return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
};

export const getFaviconUrls = (
  domain?: string,
  name?: string
): string[] => {
  let hostname = getDomain(domain ?? "");

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
