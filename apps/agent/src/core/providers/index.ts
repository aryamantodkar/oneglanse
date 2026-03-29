import type { Provider } from "@oneglanse/types";
import { chatgptConfig } from "./chatgpt/index.js";
import { geminiConfig } from "./gemini/index.js";
import { perplexityConfig } from "./perplexity/index.js";
import type { ProviderConfig } from "./types.js";

/**
 * Single source of truth for all provider behavior.
 *
 * To add a new provider:
 *   1. Create a new file in this folder (e.g. myProvider.ts)
 *   2. Export a config object that satisfies ProviderConfig
 *   3. Add it to the map below
 *
 * No other files need to change.
 */
export const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
	gemini: geminiConfig,
	chatgpt: chatgptConfig,
	perplexity: perplexityConfig,
};
