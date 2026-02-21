import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { isOpenaiAuthenticated } from "../../agents/chatgpt/auth/validateAuth.js";
import { isAnthropicAuthenticated } from "../../agents/claude/auth/validateAuth.js";
import { isGoogleAuthenticated } from "../../agents/google/gemini/auth/validateAuth.js";
import { isPerplexityAuthenticated } from "../../agents/perplexity/auth/validateAuth.js";

export async function isAuthenticated(
	page: Page,
	provider: Provider,
	skipHealthCheck = false,
): Promise<boolean> {
	switch (provider) {
		case "openai":
			return isOpenaiAuthenticated(page, skipHealthCheck);

		case "anthropic":
			return isAnthropicAuthenticated(page, skipHealthCheck);

		case "google":
			return isGoogleAuthenticated(page, skipHealthCheck, "google");

		case "google-ai-overview":
			return isGoogleAuthenticated(page, skipHealthCheck, "google-ai-overview");

		case "perplexity":
			return isPerplexityAuthenticated(page, skipHealthCheck);

		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}
