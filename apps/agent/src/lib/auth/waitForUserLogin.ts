import type { Provider } from "@onescope/types";
import type { Page } from "playwright";
import { waitForOpenaiAuthentication } from "../../agents/chatgpt/auth/auth.js";
import { waitForAnthropicAuthentication } from "../../agents/claude/auth/auth.js";
import { waitForGoogleAuthentication } from "../../agents/google/gemini/auth/auth.js";
import { waitForPerplexityAuthentication } from "../../agents/perplexity/auth/auth.js";

export async function waitForUserLogin(
	page: Page,
	provider: Provider,
	skipHealthCheck = false,
): Promise<void> {
	if (provider === "openai") {
		await waitForOpenaiAuthentication(page, 8 * 60 * 1000, skipHealthCheck);
		return;
	}
	if (provider === "anthropic") {
		await waitForAnthropicAuthentication(page, 8 * 60 * 1000, skipHealthCheck);
		return;
	}
	if (provider === "perplexity") {
		await waitForPerplexityAuthentication(page, 8 * 60 * 1000, skipHealthCheck);
		return;
	}
	if (provider === "google") {
		await waitForGoogleAuthentication(page, 8 * 60 * 1000, skipHealthCheck);
		return;
	}
	if (provider === "google-ai-overview") {
		// google.com/ai uses same Google account auth as Gemini
		await waitForGoogleAuthentication(page, 8 * 60 * 1000, skipHealthCheck);
		return;
	}
}
