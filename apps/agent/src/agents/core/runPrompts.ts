import { classifyError, ExternalServiceError, IPRefreshNeededError, ValidationError } from "@oneglanse/errors";
import { exponentialBackoff } from "@oneglanse/utils";
import type { AskPromptResult, Provider, Source } from "@oneglanse/types";
import type { PromptPayload } from "@oneglanse/types";
import type { Page } from "playwright";
import { env } from "../../env.js";
import { navigateWithRetry } from "../../lib/browser/navigate.js";
import { logger } from "../../lib/utils/logger.js";
import { validateResponse } from "../../lib/validation/validateResponse.js";
import { AGENT_PROVIDER_CONFIG } from "./providerRegistry.js";
import { askPrompt } from "./steps/askPrompt.js";
import { checkAndExtractSources } from "./steps/extractSources.js";
import { fetchPromptResponses } from "./steps/fetchPromptResponses.js";

const MAX_PROMPT_RETRIES = env.MAX_PROMPT_RETRIES_PER_IP;
const INITIAL_RETRY_DELAY = env.PROMPT_RETRY_DELAY_MS;
const MAX_RETRY_DELAY = env.MAX_PROMPT_RETRY_DELAY_MS;

const STEP_WAIT_MS = 1500; // pause between pipeline steps for page stability

// Matches extraction failures and invalid (garbage/too-short) responses
const EXTRACTION_FAILURE_RE =
	/Markdown response extraction failed|Empty response extracted|Invalid response/i;

// Canary policy: the first prompt on an unproven proxy gets only one shot — fail fast.
// A single success "proves" the proxy and unlocks MAX_PROMPT_RETRIES for subsequent prompts.
const CANARY_POLICY = { maxAttempts: 1 } as const;

function buildIpRefreshNeededError(
	message: string,
	partialResults: AskPromptResult[],
	remainingPrompts: PromptPayload["prompts"],
	failedPromptIndex: number,
	err: unknown,
): IPRefreshNeededError {
	return new IPRefreshNeededError(
		message,
		partialResults,
		remainingPrompts,
		failedPromptIndex,
		classifyError(err),
	);
}

async function executePromptAttempt(
	page: Page,
	prompt: string,
	provider: Provider,
	attempt: number,
	effectiveMaxRetries: number,
	promptIndex: number,
	totalPrompts: number,
): Promise<{ response: string; sources: Source[] }> {
	if (attempt > 1) {
		const backoffDelay = exponentialBackoff(
			attempt - 2,
			INITIAL_RETRY_DELAY,
			MAX_RETRY_DELAY,
		);
		logger.log(
			`🔄 Retry attempt ${attempt}/${effectiveMaxRetries} for prompt ${promptIndex + 1} (waiting ${backoffDelay / 1000}s)`,
		);
		await page.waitForTimeout(backoffDelay);
	}

	await askPrompt(page, prompt, provider);
	await page.waitForTimeout(STEP_WAIT_MS);

	const response = await fetchPromptResponses(page, provider);
	if (!response || response.trim().length === 0) {
		throw new ExternalServiceError(
			provider,
			"Empty response extracted; blocking source extraction and retrying prompt",
		);
	}

	const validation = validateResponse(response, provider);
	if (!validation.valid) {
		logger.warn(
			`⚠️ [${provider}] Invalid response (${response.trim().length} chars): ${validation.reason} — retrying`,
		);
		throw new ValidationError(`[${provider}] Invalid response: ${validation.reason}`, {
			provider,
			reason: validation.reason,
		});
	}

	await page.waitForTimeout(STEP_WAIT_MS);

	const sources = await checkAndExtractSources(page, provider);
	await page.waitForTimeout(STEP_WAIT_MS);

	return { response, sources };
}

async function runPromptWithPolicy(
	page: Page,
	promptEntry: NonNullable<PromptPayload["prompts"][number]>,
	provider: Provider,
	userId: string,
	workspaceId: string,
	promptIndex: number,
	totalPrompts: number,
	partialResults: AskPromptResult[],
	remainingPrompts: PromptPayload["prompts"],
	proxyProven: boolean,
): Promise<{ result: AskPromptResult; proxyNowProven: boolean }> {
	const effectiveMaxRetries = proxyProven
		? MAX_PROMPT_RETRIES
		: CANARY_POLICY.maxAttempts;

	let lastError: unknown = null;

	for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
		try {
			const { response, sources } = await executePromptAttempt(
				page,
				promptEntry.prompt,
				provider,
				attempt,
				effectiveMaxRetries,
				promptIndex,
				totalPrompts,
			);

			logger.success(
				`✓ Prompt ${promptIndex + 1}/${totalPrompts} completed${attempt > 1 ? ` (succeeded on retry ${attempt})` : ""}`,
			);

			const result: AskPromptResult = {
				userId,
				workspaceId,
				promptId: promptEntry.id,
				prompt: promptEntry.prompt,
				response,
				sources,
			};

			const proxyNowProven = !proxyProven;
			if (proxyNowProven) {
				logger.log(
					"✅ Proxy proven good after canary prompt — full retries enabled for remaining prompts",
				);
			}

			return { result, proxyNowProven };
		} catch (err: any) {
			lastError = err;
			logger.error(
				`❌ Attempt ${attempt}/${effectiveMaxRetries} failed for prompt ${promptIndex + 1}: [${provider}] ${err.message}`,
			);

			// Canary failed: immediately rotate IP without retrying
			if (!proxyProven) {
				logger.warn(
					"⚡ Canary prompt failed on unproven proxy — rotating IP immediately",
				);
				throw buildIpRefreshNeededError(
					`${provider} canary prompt failed — rotating IP. Error: ${(lastError as any)?.message}`,
					partialResults,
					remainingPrompts,
					promptIndex,
					lastError,
				);
			}

			if (EXTRACTION_FAILURE_RE.test(String((err as any)?.message ?? ""))) {
				logger.warn(
					`⚠️ Repeated extraction failure on current IP (prompt ${promptIndex + 1}, attempt ${attempt}/${effectiveMaxRetries})`,
				);
			}

			if (attempt === effectiveMaxRetries) {
				logger.error(
					`🔴 Prompt ${promptIndex + 1} failed after ${effectiveMaxRetries} attempts. Final error: ${(lastError as any)?.message}`,
				);
				logger.error("🔴 Triggering IP refresh for remaining prompts.");
				throw buildIpRefreshNeededError(
					`${provider} failed ${effectiveMaxRetries} consecutive attempts — refreshing IP. Last error: ${(lastError as any)?.message}`,
					partialResults,
					remainingPrompts,
					promptIndex,
					lastError,
				);
			}
		}
	}

	// Unreachable — loop always returns or throws
	throw new ValidationError("runPromptWithPolicy: unexpected exit without result or error");
}

export async function runPrompts(
	payload: PromptPayload,
	page: Page,
	provider: Provider,
): Promise<AskPromptResult[]> {
	logger.debug("🤖 Running prompts...\n");
	const {
		user_id: userId,
		workspace_id: workspaceId,
		prompts: promptsArray,
	} = payload;

	await page
		.waitForLoadState("domcontentloaded", { timeout: 30000 })
		.catch(() => {});

	const promptMetrics: AskPromptResult[] = [];
	let proxyProven = false;

	for (let i = 0; i < promptsArray.length; i++) {
		const promptEntry = promptsArray[i];
		if (!promptEntry) {
			logger.error(`Prompt at index ${i} is undefined.`);
			continue;
		}

		logger.debug(`\n${"=".repeat(70)}`);
		logger.debug(`Prompt ${i + 1}/${promptsArray.length}`);
		logger.debug(`${"=".repeat(70)}`);
		logger.debug(`📝 ${promptEntry.prompt}\n`);

		// runPromptWithPolicy throws IPRefreshNeededError on terminal failure — propagates up
		const { result, proxyNowProven } = await runPromptWithPolicy(
			page,
			promptEntry,
			provider,
			userId,
			workspaceId,
			i,
			promptsArray.length,
			promptMetrics,
			promptsArray.slice(i),
			proxyProven,
		);

		promptMetrics.push(result);
		if (proxyNowProven) proxyProven = true;

		// Google Search keeps the query in the URL/input; reset to a clean page
		// between prompts so each query starts from the same initial state.
		const hasMorePrompts = i < promptsArray.length - 1;
		if (provider === "google-ai-overview" && hasMorePrompts) {
			const resetUrl = AGENT_PROVIDER_CONFIG[provider].url;
			logger.debug(`[${provider}] Resetting page before next prompt: ${resetUrl}`);
			await navigateWithRetry(page, resetUrl, {
				waitUntil: "domcontentloaded",
				timeout: 30000,
			});
			await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
		}
	}

	const successCount = promptMetrics.length;
	const totalCount = promptsArray.length;
	logger.success(`✅ All prompts completed successfully (${successCount}/${totalCount})`);

	return promptMetrics;
}
