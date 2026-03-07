import { randomUUID } from "node:crypto";
import type { Provider, UserPrompt } from "@oneglanse/types";
import { ALL_PROVIDERS_JSON } from "@oneglanse/utils";
import { fetchUserPromptsForWorkspace } from "../prompt/index.js";
import { getWorkspaceById } from "../workspace/index.js";
import { getProviderQueue } from "./queue.js";
import { redis } from "./redis.js";

const AGENT_PROGRESS_TTL_SECONDS = 24 * 60 * 60;

type ProviderJobPayload = {
	jobGroupId: string;
	provider: Provider;
	prompts: UserPrompt[];
	user_id: string;
	workspace_id: string;
	created_at?: string;
};

export type SubmitAgentJobResult =
	| { status: "queued"; jobGroupId: string }
	| { status: "empty" };

async function enqueueProviderJob(payload: ProviderJobPayload): Promise<void> {
	const queue = getProviderQueue(payload.provider);
	const jobId = `${payload.jobGroupId}:${payload.provider}`;
	const existing = await queue.getJob(jobId);
	if (existing) {
		return;
	}

	await queue.add("run-provider", payload, { jobId });
}

export async function enqueueProviderJobs(args: {
	jobGroupId: string;
	prompts: UserPrompt[];
	userId: string;
	workspaceId: string;
	enabledProviders: Provider[];
}): Promise<void> {
	const { jobGroupId, prompts, userId, workspaceId, enabledProviders } = args;
	await Promise.all(
		enabledProviders.map((provider) =>
			enqueueProviderJob({
				jobGroupId,
				provider,
				prompts,
				user_id: userId,
				workspace_id: workspaceId,
			}),
		),
	);
}

/**
 * Fetches the workspace's prompts and enabled providers, then fans out one
 * BullMQ job per provider so they can run in parallel with isolated browser/
 * proxy state. Sets the Redis progress key so the client can poll for status.
 * Returns "empty" if no prompts are configured.
 */
export async function submitAgentJobGroup(args: {
	workspaceId: string;
	userId: string;
}): Promise<SubmitAgentJobResult> {
	const { workspaceId, userId } = args;

	const prompts = await fetchUserPromptsForWorkspace({ workspaceId });
	if (!prompts || prompts.length === 0) {
		console.warn(
			`[agent] submitAgentJobGroup: no prompts found for workspace ${workspaceId} — skipping`,
		);
		return { status: "empty" };
	}

	const jobGroupId = randomUUID();
	const workspace = await getWorkspaceById({ workspaceId });
	const enabledProviders = JSON.parse(
		workspace.enabledProviders ?? ALL_PROVIDERS_JSON,
	) as Provider[];

	const progress = {
		status: "pending" as const,
		updateId: 0,
		providers: Object.fromEntries(
			enabledProviders.map((p) => [p, "pending"]),
		) as Record<string, string>,
		results: Object.fromEntries(enabledProviders.map((p) => [p, 0])) as Record<
			string,
			number
		>,
		stats: {
			totalPrompts: prompts.length,
			expectedResponses: prompts.length * enabledProviders.length,
			actualResponses: 0,
		},
	};

	await redis.set(
		`job:${jobGroupId}:result`,
		JSON.stringify(progress),
		"EX",
		AGENT_PROGRESS_TTL_SECONDS,
	);

	await enqueueProviderJobs({
		jobGroupId,
		prompts,
		userId,
		workspaceId,
		enabledProviders,
	});

	return { status: "queued", jobGroupId };
}
