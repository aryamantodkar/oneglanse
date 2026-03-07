import { ValidationError, toErrorMessage } from "@oneglanse/errors";
import { redis, storePromptResponses } from "@oneglanse/services";
import type {
	AgentResult,
	ModelResult,
	PromptPayload,
	Provider,
} from "@oneglanse/types";
import { PROVIDER_LIST } from "@oneglanse/types";
import { createProviderLogger, logger } from "@oneglanse/utils";
import type { Job } from "bullmq";
import { agentHandler } from "../core/agentHandler.js";
import { createAgent } from "../core/createAgent.js";
import { PROVIDER_CONFIGS } from "../core/providers/index.js";
import { getProviderSessionScope } from "../lib/browser/providerScope.js";
import { runAnalysisInBackground } from "./analysis.js";

type ProviderStatus = "pending" | "running" | "completed" | "failed";
type ProviderJobData = {
	jobGroupId: string;
	provider: Provider;
	prompts: PromptPayload["prompts"];
	user_id: string;
	workspace_id: string;
	created_at?: string;
};

const AGENT_PROGRESS_TTL_SECONDS = 24 * 60 * 60;

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
redis.call('SET', KEYS[1], cjson.encode(data), 'EX', ${AGENT_PROGRESS_TTL_SECONDS})
return cjson.encode(data)
`;

function buildProgressSeed(provider: Provider, promptCount: number): string {
	return JSON.stringify({
		status: "pending" as const,
		updateId: 0,
		providers: { [provider]: "pending" } as Record<Provider, ProviderStatus>,
		results: { [provider]: 0 } as Record<Provider, number>,
		stats: {
			totalPrompts: promptCount,
			expectedResponses: promptCount,
			actualResponses: 0,
		},
	});
}

function buildProviderSessionKey(args: {
	provider: Provider;
	userId: string;
	workspaceId: string;
}): string {
	const { provider, userId, workspaceId } = args;
	return `session:v3:${workspaceId}:${userId}:${getProviderSessionScope(provider)}`;
}

async function ensureProgressSeed(
	progressKey: string,
	provider: Provider,
	promptCount: number,
): Promise<void> {
	await redis.set(
		progressKey,
		buildProgressSeed(provider, promptCount),
		"EX",
		AGENT_PROGRESS_TTL_SECONDS,
		"NX",
	);
}

async function updateProgress(
	progressKey: string,
	provider: Provider,
	status: ProviderStatus,
	resultCount: number | null,
): Promise<void> {
	const countArg = resultCount !== null ? String(resultCount) : "";
	const result = await redis.eval(
		UPDATE_PROGRESS_LUA,
		1,
		progressKey,
		provider,
		status,
		countArg,
	);
	if (result === null) {
		logger.warn("progress key missing during update (expired?)");
	}
}

export async function handleJob(job: Job<ProviderJobData>): Promise<boolean> {
	const { provider, jobGroupId, prompts, user_id, workspace_id } = job.data;
	const plog = createProviderLogger(provider);

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
	await ensureProgressSeed(progressKey, provider, prompts.length);

	if (PROVIDER_CONFIGS[provider].skip) {
		plog.warn("skipped (skip: true in providerRegistry)");
		await updateProgress(progressKey, provider, "failed", 0);
		return true;
	}

	await updateProgress(progressKey, provider, "running", null);

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
	const sessionKey = buildProviderSessionKey({
		provider,
		userId: user_id,
		workspaceId: workspace_id,
	});
	const profileScope = getProviderSessionScope(provider);

	let wrapped: AgentResult = { status: "rejected", data: [] };

	try {
		const result = await agentHandler(
			label,
			() => createAgent(provider, { sessionKey, profileScope }),
			payload,
			provider,
			{ sessionKey },
		);
		wrapped = {
			status: result.length > 0 ? "fulfilled" : "rejected",
			data: result,
		};
	} catch (err) {
		plog.error("failed:", toErrorMessage(err));
	}

	if (wrapped.status === "fulfilled" && wrapped.data.length > 0) {
		const emptyResult = Object.fromEntries(
			PROVIDER_LIST.map((currentProvider) => [
				currentProvider,
				{ status: "rejected" as const, data: [] },
			]),
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
