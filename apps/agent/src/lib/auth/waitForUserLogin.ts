import { Page } from "playwright";
import { waitForAnthropicAuthentication } from "../../agents/anthropic/auth/auth.js";
import { waitForOpenaiAuthentication } from "../../agents/openai/auth/auth.js";
import { waitForPerplexityAuthentication } from "../../agents/perplexity/auth/auth.js";
import { Provider } from "@onescope/types";
import { waitForGoogleAuthentication } from "../../agents/google/auth/auth.js";

export async function waitForUserLogin(page: Page, provider: Provider): Promise<void> {
    if(provider=="openai"){
      await waitForOpenaiAuthentication(page);
      return;
    }
    if(provider=="anthropic"){
      await waitForAnthropicAuthentication(page);
      return;
    }
    if(provider=="perplexity"){
      await waitForPerplexityAuthentication(page);
      return;
    }
    if(provider=="google"){
      await waitForGoogleAuthentication(page);
      return;
    }
    if(provider=="google-overview"){
      // google.com/ai uses same Google account auth as Gemini
      await waitForGoogleAuthentication(page);
      return;
    }
}