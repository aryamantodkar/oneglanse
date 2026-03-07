import { toErrorMessage, ValidationError } from "@oneglanse/errors";
import { redis, storePromptResponses } from "@oneglanse/services";
import {
	CHAIN_ORDER,
	PROVIDER_LIST,
	type AgentResult,
	type AskPromptResult,
	type ChainJobData,
	type ModelResult,
	type PromptPayload,
	type Provider,
	type UserPrompt,
} from "@oneglanse/types";
import { type Job } from "bullmq";
import { runProviderChain } from "../core/chainRunner.js";
import { agentHandler } from "../core/agentHandler.js";
import { createAgent } from "../core/createAgent.js";
import { PROVIDER_CONFIGS } from "../core/providers/index.js";
import { createProviderLogger, logger } from "@oneglanse/utils";
import { runAnalysisInBackground } from "./analysis.js";

type ProviderJobData = {
	jobGroupId: string;
	provider: Provider;
	prompts: UserPrompt[];
	user_id: string;
	workspace_id: string;
	created_at?: string;
};

type ProviderStatus = "pending" | "running" | "completed" | "failed";

const providerConfig = Object.fromEntries(
	PROVIDER_LIST.map((p) => [
		p,
		{ label: PROVIDER_CONFIGS[p].label, factory: () => createAgent(p) },
	]),
) as Record<Provider, { label: string; factory: () => ReturnType<typeof createAgent> }>;

/**
 * Lua script for atomic read-modify-write on the progress key.
 *
 * KEYS[1]  = progressKey
 * ARGV[1]  = provider name
 * ARGV[2]  = new provider status ("running" | "completed" | "failed")
 * ARGV[3]  = result count as string, or "" to leave results unchanged
 *
 * Atomically: GET → merge provider fields → recompute derived fields → SET
 * Returns the updated JSON string, or nil if the key was missing.
 */
const UPDATE_PROGRESS_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local data = cjson.decode(raw)
data['providers'][ARGV[1]] = ARGV[2]
if ARGV[3] ~= '' then
  data['results'][ARGV[1]] = tonumber(ARGV[3])
end
data['updateId'] = (data['updateId'] or 0) + 1
local total = 0
for _, v in pairs(data['results']) do total = total + v end
data['stats']['actualResponses'] = total
local allDone = true
for _, v in pairs(data['providers']) do
  if v ~= 'completed' and v ~= 'failed' then allDone = false; break end
end
if allDone then data['status'] = 'completed' end
redis.call('SET', KEYS[1], cjson.encode(data), 'EX', 3600)
return cjson.encode(data)
`;

async function updateProgress(
	progressKey: string,
	provider: Provider,
	status: ProviderStatus,
	resultCount: number | null,
): Promise<void> {
	const countArg = resultCount !== null ? String(resultCount) : "";
	const result = await redis.eval(UPDATE_PROGRESS_LUA, 1, progressKey, provider, status, countArg);
	if (result === null) {
		logger.warn(`progress key missing during update (expired?)`);
	}
}

export async function handleJob(job: Job<ProviderJobData>): Promise<boolean> {
	const data = job.data as ProviderJobData;

	const { provider, jobGroupId, prompts, user_id, workspace_id } = data;
	const plog = createProviderLogger(provider);

	if (!providerConfig[provider]) {
		throw new ValidationError(`Unknown provider: ${provider}`, { provider });
	}

	if (PROVIDER_CONFIGS[provider].skip) {
		plog.warn(`skipped (skip: true in providerRegistry)`);
		return true;
	}

	if (!prompts || prompts.length === 0) {
		throw new ValidationError("Agent job received no prompts", { provider, jobGroupId });
	}

	// Generate fresh timestamp at execution time
	const executionTime = new Date().toISOString();

	const PromptPayload: PromptPayload = {
		user_id,
		workspace_id,
		prompts: prompts.map(({ id, prompt }) => ({
			id,
			prompt,
		})),
		created_at: executionTime,
	};

	const progressKey = `job:${jobGroupId}:result`;

	// SET NX: atomically initialise only if the key is absent.
	const seed = JSON.stringify({
		status: "pending" as const,
		updateId: 0,
		providers: { [provider]: "pending" } as Record<Provider, ProviderStatus>,
		results: { [provider]: 0 } as Record<Provider, number>,
		stats: {
			totalPrompts: prompts.length,
			expectedResponses: prompts.length,
			actualResponses: 0,
		},
	});
	await redis.set(progressKey, seed, "EX", 60 * 60, "NX");

	await updateProgress(progressKey, provider, "running", null);

	let wrapped: AgentResult = { status: "rejected", data: [] };

	try {
		const { label, factory } = providerConfig[provider];
		const result = await agentHandler(
			label,
			factory,
			PromptPayload,
			provider,
		);
		wrapped = {
			status: result.length > 0 ? "fulfilled" : "rejected",
			data: result,
		};
	} catch (err) {
		plog.error(`failed:`, toErrorMessage(err));
	}

	if (wrapped.status === "fulfilled" && wrapped.data.length > 0) {
		const emptyResult = Object.fromEntries(
			PROVIDER_LIST.map((p) => [p, { status: "rejected" as const, data: [] }]),
		) as unknown as Record<Provider, AgentResult>;

		const partialResults: ModelResult = {
			...emptyResult,
			[provider]: wrapped,
		};

		await storePromptResponses({
			results: partialResults,
			userId: user_id,
			workspaceId: workspace_id,
			promptRunAt: executionTime,
		});

		runAnalysisInBackground({
			workspaceId: workspace_id,
			userId: user_id,
			provider,
			jobGroupId,
		});
	}

	const finalStatus: ProviderStatus =
		wrapped.status === "fulfilled" ? "completed" : "failed";
	await updateProgress(progressKey, provider, finalStatus, wrapped.data.length);

	return true;
}

export async function handleChainJob(job: Job<ChainJobData>): Promise<boolean> {
	const { jobGroupId, prompts, user_id, workspace_id, enabledProviders } = job.data;

	if (!prompts || prompts.length === 0) {
		throw new ValidationError("Chain job received no prompts", { jobGroupId });
	}

	const executionTime = new Date().toISOString();

	const payload: PromptPayload = {
		user_id,
		workspace_id,
		prompts: prompts.map(({ id, prompt }) => ({ id, prompt })),
		created_at: executionTime,
	};

	const progressKey = `job:${jobGroupId}:result`;

	// Filter CHAIN_ORDER to only enabled, non-skipped providers
	const providers = CHAIN_ORDER.filter(
		(p) => enabledProviders.includes(p) && !PROVIDER_CONFIGS[p]?.skip,
	);

	// Mark all chain providers as running upfront (seed already set by jobs.ts)
	for (const provider of providers) {
		await updateProgress(progressKey, provider, "running", null);
	}

	// Providers that are enabled but skipped — mark failed immediately
	const skippedEnabled = enabledProviders.filter(
		(p) => !providers.includes(p),
	);
	for (const provider of skippedEnabled) {
		await updateProgress(progressKey, provider, "failed", 0);
	}

	const processedProviders = new Set<Provider>();

	async function onProviderDone(provider: Provider, results: AskPromptResult[]): Promise<void> {
		processedProviders.add(provider);
		const status: ProviderStatus = results.length > 0 ? "completed" : "failed";

		if (results.length > 0) {
			const emptyResult = Object.fromEntries(
				PROVIDER_LIST.map((p) => [p, { status: "rejected" as const, data: [] }]),
			) as unknown as Record<Provider, AgentResult>;

			const partialResults: ModelResult = {
				...emptyResult,
				[provider]: { status: "fulfilled", data: results },
			};

			await storePromptResponses({
				results: partialResults,
				userId: user_id,
				workspaceId: workspace_id,
				promptRunAt: executionTime,
			});

			runAnalysisInBackground({
				workspaceId: workspace_id,
				userId: user_id,
				provider,
				jobGroupId,
			});
		}

		await updateProgress(progressKey, provider, status, results.length);
	}

	try {
		await runProviderChain(providers, payload, {
			onProviderStart: async (provider) => {
				logger.log(`[chain] starting ${provider}`);
			},
			onProviderDone,
		});
	} catch (err) {
		// Unrecoverable chain failure (e.g. browser process died).
		// Mark any provider we didn't finish as failed so Redis doesn't stay "running".
		logger.error(`[chain:${jobGroupId}] unrecoverable crash: ${toErrorMessage(err)}`);
		await Promise.all(
			providers
				.filter((p) => !processedProviders.has(p))
				.map((p) => updateProgress(progressKey, p, "failed", 0).catch(() => {})),
		);
	}

	logger.log(
		`[chain:${jobGroupId}] complete — processed: ${[...processedProviders].join(", ") || "none"}`,
	);

	return true;
}
