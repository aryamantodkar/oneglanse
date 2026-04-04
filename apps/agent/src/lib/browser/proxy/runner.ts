import {
	ExternalServiceError,
	IPRefreshNeededError,
	classifyError,
	toErrorMessage,
} from "@oneglanse/errors";
import {
	type AskPromptResult,
	type PromptPayload,
	type Provider,
	resolveAppMode,
	shouldUseProxyInMode,
} from "@oneglanse/types";
import {
	createProviderLogger,
	exponentialBackoff,
	logger,
} from "@oneglanse/utils";
import type { Browser, BrowserContext, Page } from "playwright";
import { runAgents } from "../../../core/runAgents.js";

// Hard ceiling on browser launch + profile warmup + initial provider navigation.
// This phase runs entirely outside the executor timeout — its own budget prevents
// a slow proxy from silently eating into the prompt execution window.
const AGENT_SETUP_TIMEOUT_MS = 2 * 60 * 1000; // 2 min

// Per-prompt budget for actual prompt execution (type → submit → wait → extract).
// Browser launch/warmup are NOT included — they are covered by AGENT_SETUP_TIMEOUT_MS.
// Scale by prompt count in runWithRetryCycles.
const PROVIDER_TIMEOUT_PER_PROMPT_MS = 5 * 60 * 1000; // 5 min per prompt
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
	invalidateProxyHint?: () => Promise<void>;
}>;

export type BrowserAttempt = {
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy?: string | null;
	cleanup?: () => Promise<void>;
	// Invalidates the shared Google proxy hint in Redis so the next retry cycle
	// picks a fresh proxy instead of reusing the same blocked/dead session.
	invalidateProxyHint?: () => Promise<void>;
};

export type AttemptExecutor = (
	attempt: BrowserAttempt,
	payload: PromptPayload,
) => Promise<AskPromptResult[]>;

type Refs = {
	browser: Browser | null;
	context: BrowserContext | null;
	page: Page | null;
	proxy: string | null;
	cleanup?: (() => Promise<void>) | null;
	invalidateProxyHint?: (() => Promise<void>) | null;
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

async function invalidateAndEvict(
	refs: Refs,
	provider: Provider,
): Promise<void> {
	// Catch individually so a hint invalidation failure never skips eviction.
	await refs.invalidateProxyHint?.().catch(() => {});
}

async function closeContextAndBrowser(refs: Refs): Promise<void> {
	// Close context first, then let cleanup() handle browser + process + forwarder.
	// Don't call refs.browser.close() here — cleanup() already does it and
	// double-closing triggers silent errors.
	const hadRefs = refs.context !== null || refs.cleanup !== null;
	await refs.context?.close().catch(() => {});
	await refs.cleanup?.().catch(() => {});
	if (hadRefs) {
		logger.debug("browser closed");
	}
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
	label: string,
	refs: Refs,
	executor: AttemptExecutor,
	timeoutMs: number,
): Promise<AskPromptResult[]> {
	// Phase 1 — setup (browser launch + warmup + initial navigation).
	// Bounded by AGENT_SETUP_TIMEOUT_MS, completely separate from the execution
	// budget below. If setup times out here any partially-launched browser is
	// abandoned (refs are still null so the finally block is a no-op); the outer
	// retry cycle will attempt a fresh launch.
	const agent = await Promise.race([
		agentFactory(),
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new ExternalServiceError(
							label,
							`browser setup timed out after ${AGENT_SETUP_TIMEOUT_MS / 1000}s`,
						),
					),
				AGENT_SETUP_TIMEOUT_MS,
			),
		),
	]);

	// Set cleanup refs before entering the execution phase so that any failure
	// or timeout during execution can always attempt teardown.
	refs.cleanup = agent.cleanup ?? null;
	refs.invalidateProxyHint = agent.invalidateProxyHint ?? null;
	refs.browser = agent.browser;
	refs.context = agent.context;
	refs.page = agent.page;
	refs.proxy = agent.proxy ?? null;

	// Phase 2 — execution (type → submit → wait for response → extract).
	// The 5-min clock starts here, after setup is fully complete.
	return await Promise.race([
		executor(agent, currentPayload),
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new ExternalServiceError(
							label,
							`prompt execution timed out after ${timeoutMs / 1000}s`,
						),
					),
				timeoutMs,
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
	executor: AttemptExecutor,
	timeoutMs?: number,
): Promise<{ done: true } | { done: false; updatedPayload: PromptPayload }> {
	const useProxy = shouldUseProxyInMode(resolveAppMode(process.env.ONEGLANSE_APP_MODE));
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
			invalidateProxyHint: null,
		};

		try {
			const result = await runSingleAttempt(
				agentFactory,
				nextPayload,
				label,
				refs,
				executor,
				timeoutMs ?? PROVIDER_TIMEOUT_PER_PROMPT_MS,
			);

			accumulatedResults.push(...result);
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
					await invalidateAndEvict(refs, provider);
					await sleep(BOT_DETECTION_COOLDOWN);
					break;
				}

				if (failureType === "rate_limited") {
					plog.warn(
						useProxy
							? `rate limited on attempt ${totalAttempt}/${totalMax}; ending the cycle early to avoid burning the proxy`
							: `rate limited on attempt ${totalAttempt}/${totalMax}; ending the cycle early before a fresh browser attempt`,
					);
					await invalidateAndEvict(refs, provider);
					break;
				}

				if (failureType === "connection_error") {
					plog.warn(
						useProxy
							? `proxy connection failed on attempt ${totalAttempt}/${totalMax}; ending cycle early — proxy is unreachable`
							: `connection failed on attempt ${totalAttempt}/${totalMax}; ending cycle early before a fresh browser attempt`,
					);
					await invalidateAndEvict(refs, provider);
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
				await invalidateAndEvict(refs, provider);
				await sleep(BOT_DETECTION_COOLDOWN);
				break;
			}

			if (failureType === "rate_limited") {
				plog.warn(
					useProxy
						? `rate limited on attempt ${totalAttempt}/${totalMax}; ending the cycle early to avoid burning the proxy`
						: `rate limited on attempt ${totalAttempt}/${totalMax}; ending the cycle early before a fresh browser attempt`,
				);
				await invalidateAndEvict(refs, provider);
				break;
			}

			if (failureType === "connection_error") {
				plog.warn(
					useProxy
						? `proxy connection failed on attempt ${totalAttempt}/${totalMax}; ending cycle early — proxy is unreachable`
						: `connection failed on attempt ${totalAttempt}/${totalMax}; ending cycle early before a fresh browser attempt`,
				);
				await invalidateAndEvict(refs, provider);
				break;
			}

			if (failureType === "browser_crash") {
				plog.warn(
					`browser crash on attempt ${totalAttempt}/${totalMax}; retrying immediately`,
				);
				continue;
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
		executor?: AttemptExecutor;
	},
): Promise<AskPromptResult[]> {
	const plog = createProviderLogger(provider);
	const accumulatedResults: AskPromptResult[] = [];
	let currentPayload = payload;
	const executor =
		options?.executor ??
		((attempt, currentAttemptPayload) =>
			runAgents(currentAttemptPayload, attempt.page, provider));

	// Scale execution timeout by prompt count so multi-prompt jobs don't time out mid-run.
	// Setup (launch + warmup + nav) is bounded separately by AGENT_SETUP_TIMEOUT_MS.
	const timeoutMs = Math.max(1, payload.prompts.length) * PROVIDER_TIMEOUT_PER_PROMPT_MS;
	plog.log(
		`setup budget: ${AGENT_SETUP_TIMEOUT_MS / 1000}s | execution budget: ${timeoutMs / 60000}min (${payload.prompts.length} prompt(s))`,
	);

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
				executor,
				timeoutMs,
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
