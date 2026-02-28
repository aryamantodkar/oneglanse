import {
	classifyError,
	ExternalServiceError,
	IPRefreshNeededError,
	toErrorMessage,
} from "@oneglanse/errors";
import type {
	AskPromptResult,
	FailureType,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import { exponentialBackoff, logger } from "@oneglanse/utils";
import type { Browser, BrowserContext, Page } from "playwright";
import { recordProxyResult } from "./pool.js";
import { runAgents } from "../../../core/runAgents.js";

const PROVIDER_TIMEOUT = 25 * 60 * 1000; // 25 minutes
export const PROXIES_PER_CYCLE = 10;
export const MAX_CYCLES = 10;
const INITIAL_BACKOFF = 5_000;
const MAX_CYCLE_BACKOFF = 60_000;
const RETRY_DELAY = 2000;

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
	proxy: string | null;
	cleanup?: (() => Promise<void>) | null;
};

async function closeContextAndBrowser(refs: Refs, label: string): Promise<void> {
	await refs.context?.close().catch(() => {});
	await refs.browser?.close().catch(() => {});
	await refs.cleanup?.().catch(() => {});
	logger.debug(`${label} browser instance closed successfully.`);
}

function updatePayloadAfterIpRefresh(
	currentPayload: PromptPayload,
	err: IPRefreshNeededError,
	label: string,
): PromptPayload {
	logger.log(
		`${label} saved ${err.partialResults.length} successful prompts, ${err.remainingPrompts.length} remaining`,
	);
	return { ...currentPayload, prompts: err.remainingPrompts };
}

async function runSingleProxyAttempt(
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
			refs.proxy = agent.proxy ?? null;

			return await runAgents(currentPayload, agent.page, provider);
		})(),
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new ExternalServiceError(label, `timed out after ${PROVIDER_TIMEOUT / 1000}s`),
					),
				PROVIDER_TIMEOUT,
			),
		),
	]);
}

async function runProxyCycle(
	label: string,
	provider: Provider,
	agentFactory: AgentFactory,
	accumulatedResults: AskPromptResult[],
	currentPayload: PromptPayload,
	cycle: number,
): Promise<{ done: true } | { done: false; updatedPayload: PromptPayload }> {
	for (let attempt = 0; attempt < PROXIES_PER_CYCLE; attempt++) {
		const totalAttempt = cycle * PROXIES_PER_CYCLE + attempt + 1;
		const totalMax = MAX_CYCLES * PROXIES_PER_CYCLE;

		const refs: Refs = { browser: null, context: null, proxy: null, cleanup: null };

		try {
			const result = await runSingleProxyAttempt(
				agentFactory,
				currentPayload,
				provider,
				label,
				refs,
			);

			accumulatedResults.push(...result);
			if (refs.proxy) {
				recordProxyResult(refs.proxy, true, undefined, provider);
			}
			return { done: true };
		} catch (err) {
			if (err instanceof IPRefreshNeededError) {
				logger.warn(
					`${label} needs IP refresh after failed attempts on prompt ${err.failedPromptIndex + 1}`,
				);

				accumulatedResults.push(...err.partialResults);
				currentPayload = updatePayloadAfterIpRefresh(currentPayload, err, label);

				if (refs.proxy) {
					const failureType =
						(err.failureType as FailureType) ?? classifyError(err);
					recordProxyResult(refs.proxy, false, failureType, provider);
				}

				if (attempt < PROXIES_PER_CYCLE - 1) {
					await new Promise((r) => setTimeout(r, RETRY_DELAY));
				}
				continue;
			}

			const failureType = classifyError(err);
			logger.error(
				`${label} failed (attempt ${totalAttempt}/${totalMax}, cycle ${cycle + 1}/${MAX_CYCLES}, type=${failureType}):`,
				toErrorMessage(err),
			);

			if (refs.proxy) {
				recordProxyResult(refs.proxy, false, failureType, provider);
			}

			if (attempt < PROXIES_PER_CYCLE - 1) {
				await new Promise((r) => setTimeout(r, RETRY_DELAY));
			}
		} finally {
			await closeContextAndBrowser(refs, label);
		}
	}

	return { done: false, updatedPayload: currentPayload };
}

/**
 * Runs prompt payload through multiple proxy cycles with exponential backoff between cycles.
 * Each cycle attempts PROXIES_PER_CYCLE proxies before giving up and refreshing the pool.
 * Returns accumulated results on success; throws ExternalServiceError when all cycles fail.
 */
export async function runWithProxyPool(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
	fetchProxies: (opts: { resetBadProxies?: boolean; forceRefresh?: boolean }) => Promise<void>,
): Promise<AskPromptResult[]> {
	const accumulatedResults: AskPromptResult[] = [];
	let currentPayload = payload;

	for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
		if (cycle > 0) {
			const backoff = exponentialBackoff(cycle - 1, INITIAL_BACKOFF, MAX_CYCLE_BACKOFF);
			logger.warn(
				`${label} cycle ${cycle + 1}/${MAX_CYCLES}: backing off ${backoff / 1000}s, refreshing proxies...`,
			);
			await new Promise((r) => setTimeout(r, backoff));

			try {
				await fetchProxies({ forceRefresh: true });
			} catch (err) {
				logger.error(`${label} failed to refresh proxies:`, toErrorMessage(err));
			}
		}

		const outcome = await runProxyCycle(
			label,
			provider,
			agentFactory,
			accumulatedResults,
			currentPayload,
			cycle,
		);

		if (outcome.done) {
			return accumulatedResults;
		}

		currentPayload = outcome.updatedPayload;
	}

	const totalAttempts = MAX_CYCLES * PROXIES_PER_CYCLE;
	logger.error(
		`🔴 ${label} EXHAUSTED — failed all ${totalAttempts} attempts across ${MAX_CYCLES} cycles for ${provider}.`,
	);
	throw new ExternalServiceError(
		provider,
		`failed all ${totalAttempts} proxy attempts across ${MAX_CYCLES} cycles — no valid proxy found`,
		503,
		{ totalAttempts, cycles: MAX_CYCLES },
	);
}
