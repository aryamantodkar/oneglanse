import {
	type AskPromptResult,
	type PromptPayload,
	type Provider,
	resolveAppMode,
	shouldUseProxyInMode,
} from "@oneglanse/types";
import type { Page } from "playwright";
import { IPRefreshNeededError, toErrorMessage } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import { env } from "../../env.js";
import { PROVIDER_CONFIGS } from "../providers/index.js";
import { executePromptWithRetry } from "./retryPolicy.js";

/**
 * Loops over all prompts in the payload and runs each through the retry policy.
 * Propagates IPRefreshNeededError immediately so the outer job handler can rotate the proxy.
 */
export async function runPrompts(
	payload: PromptPayload,
	page: Page,
	provider: Provider,
): Promise<AskPromptResult[]> {
	const { user_id: userId, workspace_id: workspaceId, prompts: promptsArray } = payload;

	await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});

	const config = PROVIDER_CONFIGS[provider];
	const results: AskPromptResult[] = [];
	const useProxy = shouldUseProxyInMode(resolveAppMode(env.ONEGLANSE_APP_MODE));
	let proxyProven = !useProxy;

	for (let i = 0; i < promptsArray.length; i++) {
		const promptEntry = promptsArray[i];
		if (!promptEntry) {
			logger.error(`Prompt at index ${i} is undefined.`);
			continue;
		}

		const preview = promptEntry.prompt.slice(0, 60) + (promptEntry.prompt.length > 60 ? "..." : "");
		logger.log(`prompt ${i + 1}/${promptsArray.length} — "${preview}"`);

		// IPRefreshNeededError propagates immediately for proxy rotation.
		// Any other terminal failure skips this prompt and preserves accumulated results.
		let executeResult: { result: AskPromptResult; proxyNowProven: boolean };
		try {
			executeResult = await executePromptWithRetry(
				page,
				promptEntry,
				provider,
				userId,
				workspaceId,
				i,
				promptsArray.length,
				results,
				promptsArray.slice(i),
				proxyProven,
			);
		} catch (err) {
			if (err instanceof IPRefreshNeededError) throw err;
			logger.error(
				`prompt ${i + 1}/${promptsArray.length} failed permanently — skipping: ${toErrorMessage(err)}`,
			);
			continue;
		}
		const { result, proxyNowProven } = executeResult;

		results.push(result);
		if (proxyNowProven) proxyProven = true;

		const hasMorePrompts = i < promptsArray.length - 1;
		if (config.betweenPromptsHook && hasMorePrompts) {
			await config.betweenPromptsHook(page);
		}
	}

	logger.success(`all ${results.length}/${promptsArray.length} prompts completed`);
	return results;
}
