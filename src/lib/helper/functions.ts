export function formatMarkdown(text: string) {
  if (!text) return "No response available";

  let html = text;

  // Convert **bold**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert *italic*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert URLs to clickable links
  html = html.replace(
    /(https?:\/\/[^\s)]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:opacity-80">$1</a>'
  );

  // Convert - bullets to • (non-destructive)
  html = html.replace(/^- (.*)$/gm, "• $1");

  // Basic markdown table support
  html = html.replace(
    /^\|(.+)\|\n\|[-| ]+\|\n((\|.*\|\n?)*)/gm,
    (_, headers, rows) => {
      const headerCells = headers
        .split("|")
        .map((h: string) => `<th>${h.trim()}</th>`)
        .join("");

      const rowHtml = rows
        .trim()
        .split("\n")
        .map((row: string) => {
          const cells = row
            .split("|")
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      return `
        <table class="table-auto border-collapse border border-gray-300 dark:border-gray-700 my-3 text-sm">
          <thead>
            <tr class="bg-gray-100 dark:bg-gray-800">${headerCells}</tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      `;
    }
  );

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

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

export function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const cleanUrl = (url: string) => {
  try {
    const u = new URL(url);
    u.searchParams.delete("utm_source"); // remove utm_source
    u.searchParams.delete("utm_medium"); // optional: remove other tracking params
    u.searchParams.delete("utm_campaign");
    return u.toString();
  } catch {
    return url; // return as-is if invalid
  }
};

export function isWithinRange(dateStr: string, days: number) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

export const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // convert 0 → 12

  return `${day}/${month}/${year} · ${hours}:${minutes} ${ampm}`;
};

export function getUniqueLinks(
  items: { title?: string; url?: string }[] = []
): { title: string; url: string }[] {
  const map = new Map<string, { title: string; url: string }>();

  for (const item of items) {
    if (!item?.url) continue;

    const domain = getDomain(item.url);
    if (!domain || map.has(domain)) continue;

    map.set(domain, {
      title: item.title || domain,
      url: item.url,
    });
  }

  return Array.from(map.values());
}