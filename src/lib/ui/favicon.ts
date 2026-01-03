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

export const getFaviconUrls = (domain?: string, name?: string): string[] => {
  const cleanDomain =
    domain?.replace(/^https?:\/\//, "").trim() || "";

  const fallbackName =
    name?.trim() ||
    cleanDomain.split(".")[0] ||
    "Brand";

  return [
    // Primary: Google favicon
    cleanDomain
      ? `https://www.google.com/s2/favicons?sz=64&domain=${cleanDomain}`
      : "",

    // Secondary: DuckDuckGo favicon
    cleanDomain
      ? `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`
      : "",

    // Tertiary: Clearbit logo
    cleanDomain
      ? `https://logo.clearbit.com/${cleanDomain}`
      : "",

    // Final fallback: Avatar (ALWAYS works)
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      fallbackName.toUpperCase()
    )}&size=64&background=E5E7EB&color=374151&bold=true`,
  ].filter(Boolean);
};
