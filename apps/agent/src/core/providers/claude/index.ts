import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";

export const claudeConfig: ProviderConfig = {
	url: "https://claude.ai/new",
	warmupDelayMs: 5000,
	skip: true,
	label: "Claude",
	displayName: "Claude",
	requiresWarmup: true,
	waitForResponse: (page) => waitForAssistantToFinish(page, "claude"),
	extractResponse: (page) => extractAssistantMarkdown(page, "claude"),
	extractSources: async (_page) => [],
};
