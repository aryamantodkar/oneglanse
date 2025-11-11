export function formatMarkdown(text: string) {
    if (!text) return "No response available"
  
    // Escape HTML for safety
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  
    // Convert **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  
    // Convert *italic*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>")
  
    // Convert URLs to clickable links
    html = html.replace(
      /(https?:\/\/[^\s)]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:opacity-80">$1</a>'
    )
  
    // Convert - bullets to •
    html = html.replace(/^- (.*)$/gm, "• $1")
  
    // Basic markdown table support
    html = html
      .replace(/^\|(.+)\|\n\|[-| ]+\|\n((\|.*\|\n?)*)/gm, (match, headers, rows) => {
        const headerCells = headers.split("|").map((h: string) => `<th>${h.trim()}</th>`).join("")
        const rowHtml = rows
          .trim()
          .split("\n")
          .map((row: string) => {
            const cells = row.split("|").map((c: string) => `<td>${c.trim()}</td>`).join("")
            return `<tr>${cells}</tr>`
          })
          .join("")
        return `<table class="table-auto border-collapse border border-gray-300 dark:border-gray-700 my-3 text-sm">
          <thead><tr class="bg-gray-100 dark:bg-gray-800">${headerCells}</tr></thead>
          <tbody>${rowHtml}</tbody>
        </table>`
      })
  
    // Convert newlines to <br>
    html = html.replace(/\n/g, "<br>")
  
    return html
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

export function parseModelError(error: any, modelName: string): string {
  if (!error) return `${modelName}: Unknown error`;

  if (error.response?.status === 401) {
    return `${modelName}: Invalid or missing API key.`;
  }
  if (error.response?.status === 429) {
    return `${modelName}: Rate limit exceeded.`;
  }
  if (error.response?.status === 402) {
    return `${modelName}: Insufficient credits.`;
  }
  if (error.code === "ENOTFOUND") {
    return `${modelName}: Network error, service unreachable.`;
  }
  if (typeof error.message === "string" && error.message.includes("timeout")) {
    return `${modelName}: Request timed out.`;
  }
  if (typeof error.message === "string") {
    return `${modelName}: ${error.message}`;
  }

  return `${modelName}: An unknown error occurred.`;
}