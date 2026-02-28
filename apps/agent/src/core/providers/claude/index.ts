import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";

export const claudeConfig: ProviderConfig = {
	url: "https://claude.ai/new",
	warmupDelayMs: 5000,
	skip: true,
	label: "Anthropic",
	displayName: "Claude",
	requiresWarmup: true,
	waitForResponse: (page) => waitForAssistantToFinish(page, "anthropic"),
	extractResponse: (page) => extractAssistantMarkdown(page, "anthropic"),
	extractSources: async (_page) => [],
};
