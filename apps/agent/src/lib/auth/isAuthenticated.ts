import { Page } from "playwright";
import { isOpenaiAuthenticated } from "../../agents/openai/auth/validateAuth.js";
import { isAnthropicAuthenticated } from "../../agents/anthropic/auth/validateAuth.js";
import { isPerplexityAuthenticated } from "../../agents/perplexity/auth/validateAuth.js";
import { Provider } from "../../types/types.js";

export async function isAuthenticated(page: Page, provider: Provider): Promise<boolean> {
  if(provider==="openai"){
    return isOpenaiAuthenticated(page);
  }
  if(provider==="anthropic"){
    return isAnthropicAuthenticated(page);
  }
  else return isPerplexityAuthenticated(page);
}