import { Page } from "playwright";
import { isOpenaiAuthenticated } from "../../agents/openai/auth/validateAuth.js";
import { isAnthropicAuthenticated } from "../../agents/anthropic/auth/validateAuth.js";
import { isPerplexityAuthenticated } from "../../agents/perplexity/auth/validateAuth.js";
import { Provider } from "@onescope/types";
import { isGoogleAuthenticated } from "../../agents/google/auth/validateAuth.js";

export async function isAuthenticated(
  page: Page,
  provider: Provider
): Promise<boolean> {
  switch (provider) {
    case "openai":
      return isOpenaiAuthenticated(page);

    case "anthropic":
      return isAnthropicAuthenticated(page);

    case "google":
      return isGoogleAuthenticated(page);

    case "google-ai-overview":
      // google.com/aimode uses same Google account auth as Gemini
      // Skip health check since AI Overview is a search interface, not a chat interface
      return isGoogleAuthenticated(page, true);

    case "perplexity":
      return isPerplexityAuthenticated(page);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}