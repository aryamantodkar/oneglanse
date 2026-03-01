import { toErrorMessage, ValidationError } from "@oneglanse/errors";
import { redis, storePromptResponses } from "@oneglanse/services";
import {
	PROVIDER_LIST,
	type AgentResult,
	type ModelResult,
	type PromptPayload,
	type Provider,
	type UserPrompt,
} from "@oneglanse/types";
import { type Job } from "bullmq";
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
	created_at?: string; // Optional - worker generates fresh timestamp if not provided
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
	// Whichever provider wins the race writes the seed object;
	// all others skip and fall through to their own update below.
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

	// Atomically mark this provider as running
	await updateProgress(progressKey, provider, "running", null);

	let wrapped: AgentResult = { status: "rejected", data: [] };

	// ── All providers: Playwright browser path ───────────────────────────────
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

	// Store successful results immediately
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

		// Trigger analysis asynchronously; do not block provider completion.
		runAnalysisInBackground({
			workspaceId: workspace_id,
			userId: user_id,
			provider,
			jobGroupId,
		});
	}

	// Atomically mark final state and merge result count.
	// Reads the *current* Redis value — not a stale in-memory snapshot —
	// so concurrent provider updates made during this job's execution are preserved.
	const finalStatus: ProviderStatus =
		wrapped.status === "fulfilled" ? "completed" : "failed";
	await updateProgress(progressKey, provider, finalStatus, wrapped.data.length);

	return true;
}
