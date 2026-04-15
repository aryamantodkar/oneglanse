import { PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import { logger } from "@oneglanse/utils";
import { navigateWithRetry } from "../../../lib/browser/navigate.js";
import {
	findActiveEditorCandidateFromSelectors,
} from "../../../lib/input/editor/findEditor.js";
import { extractAssistantMarkdown } from "../../../lib/input/markdown/toMarkdown.js";
import { insertPromptIntoEditor } from "../../../lib/input/editor/promptInput.js";
import { waitForAssistantToFinish } from "../../../lib/input/response/waitForFinish.js";
import { extractAIOverviewSources } from "./lib/extractSources.js";
import { expandAIOverviewSources } from "./lib/expand.js";
import {
	AI_OVERVIEW_URL,
	resetAIOverviewPage,
} from "./lib/pageLifecycle.js";
import {
	assertAIOverviewPageNotBlocked,
	dismissGoogleConsentDialog,
	ensureAIOverviewGoogleSession,
	waitForAIOverviewSearchResults,
} from "./lib/session.js";
import type { ProviderConfig } from "../types.js";

export const aiOverviewConfig: ProviderConfig = {
	url: AI_OVERVIEW_URL,
	label: "AI Overview",
	displayName: "AI Overview",
	skipInitialNavigation: true,
	navigateToPrompt: async (page, prompt) => {
		await ensureAIOverviewGoogleSession(page);
		await navigateWithRetry(page, AI_OVERVIEW_URL, {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});

		assertAIOverviewPageNotBlocked(page);
		await dismissGoogleConsentDialog(page);

		const searchInput = await findActiveEditorCandidateFromSelectors(page, [
			...PROVIDER_EDITOR_SELECTORS["ai-overview"],
		]);
		logger.debug(`[ai-overview] using search selector: ${searchInput.selector}`);

		logger.debug(`[ai-overview] pasting ${prompt.length} chars…`);
		await insertPromptIntoEditor(
			page,
			searchInput.locator,
			prompt,
			"ai-overview",
		);
		logger.debug(`[ai-overview] pasting ${prompt.length} chars complete`);
		await page.waitForTimeout(400);

		logger.debug("[ai-overview] attempting submission…");
		await page.keyboard.press("Enter");
		await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(
			() => {},
		);
		await waitForAIOverviewSearchResults(page);
		await dismissGoogleConsentDialog(page);
		assertAIOverviewPageNotBlocked(page);
		logger.log(`[ai-overview] search ready: ${page.url()}`);
	},
	waitForResponse: (page) => waitForAssistantToFinish(page, "ai-overview"),
	extractResponse: (page) => extractAssistantMarkdown(page, "ai-overview"),
	beforeRetryHook: resetAIOverviewPage,
	betweenPromptsHook: resetAIOverviewPage,
	extractSources: async (page) => {
		await expandAIOverviewSources(page);
		return extractAIOverviewSources(page);
	},
};
