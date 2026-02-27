import { classifyError, IPRefreshNeededError } from "@oneglanse/errors";
import { exponentialBackoff } from "@oneglanse/utils";
import type { AskPromptResult, FailureType, PromptPayload, Provider } from "@oneglanse/types";
import type { Browser, BrowserContext, Page } from "playwright";
import {
	fetchProxies,
	recordProxyResult,
} from "../../lib/browser/proxy/pool.js";
import { logger } from "../../lib/utils/logger.js";
import { runAgents } from "./runAgents.js";

const PROVIDER_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const PROXIES_PER_CYCLE = 10; // More proxies per cycle since health checks fail fast
const MAX_CYCLES = 10; // Fewer cycles needed with fast-fail
const INITIAL_BACKOFF = 5_000; // 5 seconds — shorter since bad proxies are caught quickly
const MAX_CYCLE_BACKOFF = 60_000; // Cap cycle backoff at 60s
const RETRY_DELAY = 2000; // 2 seconds between proxy attempts

type AgentFactory = () => Promise<{
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
			refs.browser = agent.browser;
			refs.context = agent.context;
			refs.proxy = agent.proxy ?? null;
			refs.cleanup = agent.cleanup ?? null;

			return await runAgents(currentPayload, agent.page, provider);
		})(),
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(`${label} timed out after ${PROVIDER_TIMEOUT / 1000}s`),
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

			// Success — record good proxy
			accumulatedResults.push(...result);
			if (refs.proxy) {
				recordProxyResult(refs.proxy, true, undefined, provider);
			}
			return { done: true };
		} catch (err: any) {
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

			// Regular error — classify and record for proxy scoring
			const failureType = classifyError(err);
			logger.error(
				`${label} failed (attempt ${totalAttempt}/${totalMax}, cycle ${cycle + 1}/${MAX_CYCLES}, type=${failureType}):`,
				err?.message ?? err,
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

export async function agentHandler(
	label: string,
	agentFactory: AgentFactory,
	payload: PromptPayload,
	provider: Provider,
): Promise<AskPromptResult[]> {
	const accumulatedResults: AskPromptResult[] = [];
	let currentPayload = payload;

	try {
		await fetchProxies({ resetBadProxies: true });
		logger.log(`${label} initialized proxy pool`);
	} catch (err: any) {
		logger.error(`${label} failed to initialize proxy pool:`, err?.message);
	}

	for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
		if (cycle > 0) {
			const backoff = exponentialBackoff(cycle - 1, INITIAL_BACKOFF, MAX_CYCLE_BACKOFF);
			logger.warn(
				`${label} cycle ${cycle + 1}/${MAX_CYCLES}: backing off ${backoff / 1000}s, refreshing proxies...`,
			);
			await new Promise((r) => setTimeout(r, backoff));

			try {
				await fetchProxies({ forceRefresh: true });
			} catch (err: any) {
				logger.error(`${label} failed to refresh proxies:`, err?.message);
			}
		}

		try {
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
		} catch (err: any) {
			throw err;
		}
	}

	const totalAttempts = MAX_CYCLES * PROXIES_PER_CYCLE;
	logger.error(
		`🔴 ${label} EXHAUSTED — failed all ${totalAttempts} attempts across ${MAX_CYCLES} cycles for ${provider}.`,
	);
	throw new Error(
		`${provider} failed all ${totalAttempts} proxy attempts across ${MAX_CYCLES} cycles — no valid proxy found.`,
	);
}
