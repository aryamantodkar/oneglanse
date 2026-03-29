import { randomUUID } from "node:crypto";
import { toErrorMessage } from "@oneglanse/errors";
import type { Provider, UserPrompt } from "@oneglanse/types";
import { PROVIDER_LIST } from "@oneglanse/types";
import { fetchUserPromptsForWorkspace } from "../prompt/index.js";
import { getProviderQueue } from "./queue.js";
import { redis, waitForRedis } from "./redis.js";

const AGENT_PROGRESS_TTL_SECONDS = 24 * 60 * 60;

type ProviderJobPayload = {
	jobGroupId: string;
	provider: Provider;
	runProviders?: Provider[];
	prompts: UserPrompt[];
	user_id: string;
	workspace_id: string;
	created_at?: string;
};

export type SubmitAgentJobResult =
	| { status: "queued"; jobGroupId: string }
	| { status: "empty" };

function buildProviderJobId(jobGroupId: string, provider: Provider): string {
	return `${jobGroupId}__${provider}`;
}

async function enqueueProviderJob(payload: ProviderJobPayload): Promise<void> {
	const queue = getProviderQueue(payload.provider);
	try {
		await queue.waitUntilReady();
		const jobId = buildProviderJobId(payload.jobGroupId, payload.provider);
		const existing = await queue.getJob(jobId);
		if (existing) {
			return;
		}

		await queue.add("run-provider", payload, { jobId });
	} catch (err) {
		throw new Error(
			`failed to enqueue ${payload.provider} provider job: ${toErrorMessage(err)}`,
		);
	}
}

function buildProviderJobs(): Array<{
	provider: Provider;
	runProviders: Provider[];
}> {
	return PROVIDER_LIST.map((provider) => ({
		provider,
		runProviders: [provider],
	}));
}

export async function enqueueProviderJobs(args: {
	jobGroupId: string;
	prompts: UserPrompt[];
	userId: string;
	workspaceId: string;
}): Promise<void> {
	const { jobGroupId, prompts, userId, workspaceId } = args;
	const providerJobs = buildProviderJobs();
	await Promise.all(
		providerJobs.map(({ provider, runProviders }) =>
			enqueueProviderJob({
				jobGroupId,
				provider,
				runProviders,
				prompts,
				user_id: userId,
				workspace_id: workspaceId,
			}),
		),
	);
}

/**
 * Fetches the workspace's prompts, then fans out one
 * BullMQ job per provider so they can run in parallel with isolated browser/
 * proxy state. Sets the Redis progress key so the client can poll for status.
 * Returns "empty" if no prompts are configured.
 */
export async function submitAgentJobGroup(args: {
	workspaceId: string;
	userId: string;
}): Promise<SubmitAgentJobResult> {
	const { workspaceId, userId } = args;

	let prompts: UserPrompt[];
	try {
		prompts = await fetchUserPromptsForWorkspace({ workspaceId });
	} catch (err) {
		throw new Error(`failed to load workspace prompts: ${toErrorMessage(err)}`);
	}

	if (!prompts || prompts.length === 0) {
		console.warn(
			`[agent] submitAgentJobGroup: no prompts found for workspace ${workspaceId} — skipping`,
		);
		return { status: "empty" };
	}

	const jobGroupId = randomUUID();
	await waitForRedis();

	const progress = {
		status: "pending" as const,
		updateId: 0,
		providers: Object.fromEntries(
			PROVIDER_LIST.map((p) => [p, "pending"]),
		) as Record<string, string>,
		results: Object.fromEntries(PROVIDER_LIST.map((p) => [p, 0])) as Record<
			string,
			number
		>,
		stats: {
			totalPrompts: prompts.length,
			expectedResponses: prompts.length * PROVIDER_LIST.length,
			actualResponses: 0,
		},
	};

	await redis.set(
		`job:${jobGroupId}:result`,
		JSON.stringify(progress),
		"EX",
		AGENT_PROGRESS_TTL_SECONDS,
	);

	try {
		await enqueueProviderJobs({
			jobGroupId,
			prompts,
			userId,
			workspaceId,
		});
	} catch (err) {
		throw new Error(`failed to queue provider jobs: ${toErrorMessage(err)}`);
	}

	return { status: "queued", jobGroupId };
}
