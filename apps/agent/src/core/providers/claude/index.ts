import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { resetProviderPage } from "../_shared/resetProviderPage.js";
import type { ProviderConfig } from "../types.js";
import { extractSourcesFromClaude } from "./lib/extractSources.js";

const CLAUDE_URL = "https://claude.ai/new";

async function resetClaudePage(
	page: Parameters<ProviderConfig["waitForResponse"]>[0],
): Promise<void> {
	await resetProviderPage(page, "claude", CLAUDE_URL);
}

export const claudeConfig: ProviderConfig = {
	url: CLAUDE_URL,
	label: "Claude",
	displayName: "Claude",
	beforeRetryHook: resetClaudePage,
	waitForResponse: (page) => waitForAssistantToFinish(page, "claude"),
	extractResponse: (page) => extractAssistantMarkdown(page, "claude"),
	extractSources: (page) => extractSourcesFromClaude(page),
};
