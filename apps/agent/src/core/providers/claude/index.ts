import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import type { ProviderConfig } from "../types.js";
import { extractSourcesFromClaude } from "./lib/extractSources.js";
import { CLAUDE_URL, resetClaudePage } from "./lib/pageLifecycle.js";

export const claudeConfig: ProviderConfig = {
	url: CLAUDE_URL,
	label: "Claude",
	displayName: "Claude",
	beforeRetryHook: resetClaudePage,
	waitForResponse: (page) => waitForAssistantToFinish(page, "claude"),
	extractResponse: (page) => extractAssistantMarkdown(page, "claude"),
	extractSources: (page) => extractSourcesFromClaude(page),
};
