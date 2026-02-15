import { getDomain } from "./url/getDomain.js";

export const getModelFavicon = (model: string): string => {
    const modelDomains: Record<string, string> = {
      OpenAI: "openai.com",
      Anthropic: "anthropic.com",
      Perplexity: "perplexity.ai",
      Mistral: "mistral.ai",
      Gemini: "gemini.google.com",
      Meta: "about.fb.com",
      Cohere: "cohere.com",
    };
  
    // If "All Models", return empty string (we’ll use Bot icon instead)
    if (model === "All Models") return "";
  
    const domain = modelDomains[model] || `${model.toLowerCase()}.com`;
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
