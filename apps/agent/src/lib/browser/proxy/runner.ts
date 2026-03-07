import {
	ExternalServiceError,
	IPRefreshNeededError,
	classifyError,
	toErrorMessage,
} from "@oneglanse/errors";
import type {
	AskPromptResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import {
	createProviderLogger,
	exponentialBackoff,
	logger,
} from "@oneglanse/utils";
import type { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "../../../core/runAgents.js";
import { storeWarmBrowser } from "../warmPool.js";

const PROVIDER_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const ATTEMPTS_PER_CYCLE = 10;
const MAX_CYCLES = 3;
const INITIAL_BACKOFF = 5_000;
const MAX_CYCLE_BACKOFF = 60_000;
const RETRY_DELAY = 5_000;
const BOT_DETECTION_COOLDOWN = 30_000;

export type AgentFactory = () => Promise<{
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy?: string | null;
	cleanup?: () => Promise<void>;
}>;

type Refs = {
	browser: Browser | null;
	context: BrowserContext | null;
	page: Page | null;
	proxy: string | null;
	cleanup?: (() => Promise<void>) | null;
};

function jitter(baseMs: number, factor = 0.3): number {
	const delta = Math.round(baseMs * factor);
	const min = Math.max(0, baseMs - delta);
	const max = baseMs + delta;
	return Math.round(min + Math.random() * (max - min));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFailureType(err: unknown): ReturnType<typeof classifyError> {
	if (err instanceof IPRefreshNeededError && err.failureType) {
		return err.failureType as ReturnType<typeof classifyError>;
	}

	return classifyError(err);
}

async function closeContextAndBrowser(refs: Refs): Promise<void> {
	await refs.context?.close().catch(() => {});
	await refs.browser?.close().catch(() => {});
	await refs.cleanup?.().catch(() => {});
	logger.debug("browser closed");
}

function updatePayloadAfterIpRefresh(
	currentPayload: PromptPayload,
	err: IPRefreshNeededError,
): PromptPayload {
	logger.log(
		`saved ${err.partialResults.length} prompts, ${err.remainingPrompts.length} remaining after IP refresh`,
	);
	return { ...currentPayload, prompts: err.remainingPrompts };
}

async function runSingleAttempt(
	agentFactory: AgentFactory,
	currentPayload: PromptPayload,
	provider: Provider,
	label: string,
	refs: Refs,
): Promise<AskPromptResult[]> {
	return await Promise.race([
		(async () => {
			const agent = await agentFactory();
			// Set cleanup first so timeout/failure paths can always attempt teardown.
			refs.cleanup = agent.cleanup ?? null;
			refs.browser = agent.browser;
			refs.context = agent.context;
			refs.page = agent.page;
			refs.proxy = agent.proxy ?? null;

			return await runAgents(currentPayload, agent.page, provider);
		})(),
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new ExternalServiceError(
							label,
							`timed out after ${PROVIDER_TIMEOUT / 1000}s`,
						),
					),
				PROVIDER_TIMEOUT,
			),
		),
	]);
}

async function runRetryCycle(
	label: string,
	provider: Provider,
	agentFactory: AgentFactory,
	accumulatedResults: AskPromptResult[],
	currentPayload: PromptPayload,
	cycle: number,
	plog: ReturnType<typeof createProviderLogger>,
	sessionKey?: string,
): Promise<{ done: true } | { done: false; updatedPayload: PromptPayload }> {
	let nextPayload = currentPayload;

	for (let attempt = 0; attempt < ATTEMPTS_PER_CYCLE; attempt++) {
		const totalAttempt = cycle * ATTEMPTS_PER_CYCLE + attempt + 1;
		const totalMax = MAX_CYCLES * ATTEMPTS_PER_CYCLE;

		const refs: Refs = {
			browser: null,
			context: null,
			page: null,
			proxy: null,
			cleanup: null,
		};

		try {
			const result = await runSingleAttempt(
				agentFactory,
				nextPayload,
				provider,
				label,
				refs,
			);

			accumulatedResults.push(...result);

			// Store the healthy browser in the warm pool so the next job for this
			// provider can reuse it without a full browser launch. Null refs so the
			// finally block's closeContextAndBrowser becomes a no-op.
			if (sessionKey && refs.browser && refs.context && refs.page) {
				await storeWarmBrowser(provider, sessionKey, {
					browser: refs.browser,
					context: refs.context,
					page: refs.page,
					proxy: refs.proxy,
					cleanup: refs.cleanup ?? null,
					storedAt: Date.now(),
				}).catch(() => {}); // storage failure → finally closes normally
				refs.browser = null;
				refs.context = null;
				refs.page = null;
				refs.cleanup = null;
			}

			return { done: true };
		} catch (err) {
			if (err instanceof IPRefreshNeededError) {
				const failureType = getFailureType(err);
				plog.warn(
					`needs IP refresh after failed attempts on prompt ${err.failedPromptIndex + 1} (type=${failureType})`,
				);

				accumulatedResults.push(...err.partialResults);
				nextPayload = updatePayloadAfterIpRefresh(nextPayload, err);

				if (failureType === "bot_detection") {
					plog.warn(
						`bot detection on attempt ${totalAttempt}/${totalMax}; cooling down ${BOT_DETECTION_COOLDOWN / 1000}s and ending the cycle early`,
					);
					await sleep(BOT_DETECTION_COOLDOWN);
					break;
				}

				if (failureType === "rate_limited") {
					plog.warn(
						`rate limited on attempt ${totalAttempt}/${totalMax}; ending the cycle early to avoid burning the proxy`,
					);
					break;
				}

				if (attempt < ATTEMPTS_PER_CYCLE - 1) {
					await sleep(jitter(RETRY_DELAY));
				}
				continue;
			}

			const failureType = getFailureType(err);
			plog.error(
				`failed (attempt ${totalAttempt}/${totalMax}, cycle ${cycle + 1}/${MAX_CYCLES}, type=${failureType}):`,
				toErrorMessage(err),
			);

			if (failureType === "bot_detection") {
				plog.warn(
					`bot detection on attempt ${totalAttempt}/${totalMax}; cooling down ${BOT_DETECTION_COOLDOWN / 1000}s and ending the cycle early`,
				);
				await sleep(BOT_DETECTION_COOLDOWN);
				break;
			}

			if (failureType === "rate_limited") {
				plog.warn(
					`rate limited on attempt ${totalAttempt}/${totalMax}; ending the cycle early to avoid burning the proxy`,
				);
				break;
			}

			if (attempt < ATTEMPTS_PER_CYCLE - 1) {
				await sleep(jitter(RETRY_DELAY));
			}
		} finally {
			await closeContextAndBrowser(refs);
		}
	}

	return { done: false, updatedPayload: nextPayload };
}

/**
 * Runs prompt payload through retry cycles with exponential backoff between cycles.
 * Each cycle attempts ATTEMPTS_PER_CYCLE browser launches before giving up.
 * Returns accumulated results on success; throws ExternalServiceError when all cycles fail.
 */
export async function runWithRetryCycles(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
	options?: {
		sessionKey?: string;
	},
): Promise<AskPromptResult[]> {
	const plog = createProviderLogger(provider);
	const accumulatedResults: AskPromptResult[] = [];
	let currentPayload = payload;

	for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
		if (cycle > 0) {
			const backoff = jitter(
				exponentialBackoff(cycle - 1, INITIAL_BACKOFF, MAX_CYCLE_BACKOFF),
			);
			plog.warn(
				`cycle ${cycle + 1}/${MAX_CYCLES}: backing off ${backoff / 1000}s before retry...`,
			);
			await sleep(backoff);
		}

		const outcome = await runRetryCycle(
			label,
			provider,
			agentFactory,
			accumulatedResults,
			currentPayload,
			cycle,
			plog,
			options?.sessionKey,
		);

		if (outcome.done) {
			return accumulatedResults;
		}

		currentPayload = outcome.updatedPayload;
	}

	const totalAttempts = MAX_CYCLES * ATTEMPTS_PER_CYCLE;
	plog.error(
		`exhausted — failed all ${totalAttempts} attempts across ${MAX_CYCLES} cycles`,
	);
	throw new ExternalServiceError(
		provider,
		`failed all ${totalAttempts} attempts across ${MAX_CYCLES} cycles`,
		503,
		{ totalAttempts, cycles: MAX_CYCLES },
	);
}
