import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { isOpenaiAuthenticated } from "../../agents/chatgpt/auth/validateAuth.js";
import { isAnthropicAuthenticated } from "../../agents/claude/auth/validateAuth.js";
import { isGoogleAuthenticated } from "../../agents/google/gemini/auth/validateAuth.js";
import { isPerplexityAuthenticated } from "../../agents/perplexity/auth/validateAuth.js";

export async function isAuthenticated(
	page: Page,
	provider: Provider,
): Promise<boolean> {
	switch (provider) {
		case "openai":
			return isOpenaiAuthenticated(page);

		case "anthropic":
			return isAnthropicAuthenticated(page);

		case "google":
			return isGoogleAuthenticated(page, false, "google");

		case "google-ai-overview":
			return isGoogleAuthenticated(page, false, "google-ai-overview");

		case "perplexity":
			return isPerplexityAuthenticated(page);

		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}
