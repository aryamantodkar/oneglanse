import { ValidationError, classifyError, toErrorMessage } from "@oneglanse/errors";
import {
	buildProviderCancelKey,
	buildProviderJobId,
	hasRuntimeProviderAuth,
	redis,
	storePromptResponses,
	updateProviderProgress,
	writeProviderAuthStatus,
} from "@oneglanse/services";
import type {
	AgentResult,
	AuthProvider,
	ModelResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import { AUTH_PROVIDER_LIST, PROVIDER_LIST } from "@oneglanse/types";
import { createProviderLogger, logger } from "@oneglanse/utils";
import type { Job } from "bullmq";
import { agentHandler } from "../core/agentHandler.js";
import { createAgent } from "../core/createAgent.js";
import { PROVIDER_CONFIGS } from "../core/providers/index.js";
import { StopProviderRunError } from "../lib/browser/proxy/runner.js";
import { runAnalysisInBackground } from "./analysis.js";

type ProviderStatus = "pending" | "running" | "completed" | "failed" | "stopped";
type ProviderJobData = {
	jobGroupId: string;
	provider: Provider;
	runProviders?: Provider[];
	prompts: PromptPayload["prompts"];
	user_id: string;
	workspace_id: string;
	created_at?: string;
};

const AGENT_PROGRESS_TTL_SECONDS = 24 * 60 * 60;
const activeProviderStops = new Map<string, () => Promise<void>>();

function buildProgressSeed(providers: Provider[], promptCount: number): string {
	return JSON.stringify({
		status: "pending" as const,
		updateId: 0,
		providers: Object.fromEntries(
			providers.map((provider) => [provider, "pending"]),
		) as Record<Provider, ProviderStatus>,
		results: Object.fromEntries(
			providers.map((provider) => [provider, 0]),
		) as Record<Provider, number>,
		stats: {
			totalPrompts: promptCount,
			expectedResponses: promptCount * providers.length,
			actualResponses: 0,
		},
	});
}

async function ensureProgressSeed(
	progressKey: string,
	providers: Provider[],
	promptCount: number,
): Promise<void> {
	await redis.set(
		progressKey,
		buildProgressSeed(providers, promptCount),
		"EX",
		AGENT_PROGRESS_TTL_SECONDS,
		"NX",
	);
}

function normalizeRunProviders(
	provider: Provider,
	runProviders?: Provider[],
): Provider[] {
	const providers = (runProviders?.length ? runProviders : [provider]).filter(
		(currentProvider, index, values): currentProvider is Provider =>
			PROVIDER_LIST.includes(currentProvider) &&
			values.indexOf(currentProvider) === index,
	);
	return providers.length > 0 ? providers : [provider];
}

function buildEmptyResults(): Record<Provider, AgentResult> {
	return Object.fromEntries(
		PROVIDER_LIST.map((currentProvider) => [
			currentProvider,
			{ status: "rejected" as const, data: [] },
		]),
	) as unknown as Record<Provider, AgentResult>;
}

function registerActiveProviderStop(
	jobGroupId: string,
	provider: Provider,
	stop: () => Promise<void>,
): void {
	activeProviderStops.set(buildProviderJobId(jobGroupId, provider), stop);
}

function unregisterActiveProviderStop(
	jobGroupId: string,
	provider: Provider,
): void {
	activeProviderStops.delete(buildProviderJobId(jobGroupId, provider));
}

export async function stopActiveProviderRun(args: {
	jobGroupId: string;
	provider: Provider;
}): Promise<boolean> {
	const stop = activeProviderStops.get(
		buildProviderJobId(args.jobGroupId, args.provider),
	);
	if (!stop) return false;
	await stop();
	return true;
}

export async function handleJob(job: Job<ProviderJobData>): Promise<boolean> {
	const { provider, jobGroupId, prompts, runProviders, user_id, workspace_id } =
		job.data;
	const plog = createProviderLogger(provider);
	const ownedProviders = normalizeRunProviders(provider, runProviders);

	if (!PROVIDER_LIST.includes(provider)) {
		throw new ValidationError(`Unknown provider: ${provider}`, { provider });
	}

	if (!prompts || prompts.length === 0) {
		throw new ValidationError("Agent job received no prompts", {
			provider,
			jobGroupId,
		});
	}

	const progressKey = `job:${jobGroupId}:result`;
	await ensureProgressSeed(progressKey, ownedProviders, prompts.length);
	const hasAuth = await hasRuntimeProviderAuth(provider);
	if (!hasAuth) {
		plog.warn("skipped (no authenticated session)");
		await Promise.all(
			ownedProviders.map((currentProvider) =>
				updateProviderProgress({
					jobGroupId,
					provider: currentProvider,
					status: "failed",
					resultCount: 0,
				}),
			),
		);
		return true;
	}

	if (
		ownedProviders.some(
			(currentProvider) => PROVIDER_CONFIGS[currentProvider].skip,
		)
	) {
		plog.warn("skipped (skip: true in providerRegistry)");
		await Promise.all(
			ownedProviders.map((currentProvider) =>
				updateProviderProgress({
					jobGroupId,
					provider: currentProvider,
					status: "failed",
					resultCount: 0,
				}),
			),
		);
		return true;
	}

	const stopController = new AbortController();
	let activeAttemptCleanup: (() => Promise<void>) | null = null;
	const executionTime = new Date().toISOString();
	const payload: PromptPayload = {
		user_id,
		workspace_id,
		prompts: prompts.map(({ id, prompt }) => ({
			id,
			prompt,
		})),
		created_at: executionTime,
	};
	const label = PROVIDER_CONFIGS[provider].label;
	const providerResults = buildEmptyResults();

	registerActiveProviderStop(jobGroupId, provider, async () => {
		stopController.abort();
		await activeAttemptCleanup?.().catch(() => {});
	});

	try {
		try {
			await Promise.all(
				ownedProviders.map((currentProvider) =>
					updateProviderProgress({
						jobGroupId,
						provider: currentProvider,
						status: "running",
						resultCount: null,
					}),
				),
			);

			if (
				(await redis.get(buildProviderCancelKey(jobGroupId, provider))) === "1"
			) {
				throw new StopProviderRunError(provider);
			}

			const result = await agentHandler(
				label,
				() => createAgent(provider),
				payload,
				provider,
				{
					signal: stopController.signal,
					onAttemptStart: (attempt) => {
						activeAttemptCleanup = async () => {
							await attempt.context.close().catch(() => {});
							await attempt.cleanup?.().catch(() => {});
						};
					},
					onAttemptComplete: () => {
						activeAttemptCleanup = null;
					},
					onPromptProgress: async (current) => {
						await updateProviderProgress({
							jobGroupId,
							provider,
							status: "running",
							resultCount: current,
						});
					},
				},
			);

			// agentHandler handles StopProviderRunError internally and returns
			// partial/empty results — check signal here to still mark as stopped.
			if (stopController.signal.aborted) {
				throw new StopProviderRunError(provider);
			}

			providerResults[provider] = {
				status: result.length > 0 ? "fulfilled" : "rejected",
				data: result,
			};
		} catch (err) {
			if (err instanceof StopProviderRunError) {
				plog.warn("stopped from UI");
				await Promise.all(
					ownedProviders.map((currentProvider) =>
						updateProviderProgress({
							jobGroupId,
							provider: currentProvider,
							status: "stopped",
							resultCount: 0,
						}),
					),
				);
				return true;
			}
			plog.error("failed:", toErrorMessage(err));
			if (
				classifyError(err) === "logged_out" &&
				(AUTH_PROVIDER_LIST as readonly string[]).includes(provider)
			) {
				await writeProviderAuthStatus(provider as AuthProvider, {
					connecting: false,
					lastUpdatedAt: new Date().toISOString(),
					syncedAt: null,
					error: "Session expired — please re-authenticate",
					launcherPid: null,
				}).catch(() => {});
			}
		}

		const fulfilledProviders = ownedProviders.filter(
			(currentProvider) =>
				providerResults[currentProvider].status === "fulfilled",
		);

		if (fulfilledProviders.length > 0) {
			const partialResults: ModelResult = providerResults;

			try {
				await storePromptResponses({
					results: partialResults,
					userId: user_id,
					workspaceId: workspace_id,
					promptRunAt: executionTime,
				});
			} catch (storeErr) {
				// Extraction succeeded but save failed — log prominently but do not
				// rethrow. Rethrowing would cause BullMQ to retry the entire job
				// (re-running the browser and re-querying the AI), which is wasteful
				// and wrong for a storage failure.
				plog.error(
					"❌ failed to persist results to ClickHouse:",
					toErrorMessage(storeErr),
				);
			}

			runAnalysisInBackground({
				workspaceId: workspace_id,
				userId: user_id,
				provider,
				jobGroupId,
			});
		}

		await Promise.all(
			ownedProviders.map((currentProvider) =>
				updateProviderProgress({
					jobGroupId,
					provider: currentProvider,
					status:
						providerResults[currentProvider].status === "fulfilled"
							? "completed"
							: "failed",
					resultCount: providerResults[currentProvider].data.length,
				}),
			),
		);

		return true;
	} finally {
		unregisterActiveProviderStop(jobGroupId, provider);
	}
}
