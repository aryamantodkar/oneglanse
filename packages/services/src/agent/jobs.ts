import { randomUUID } from "node:crypto";
import { toErrorMessage } from "@oneglanse/errors";
import type { Provider, UserPrompt } from "@oneglanse/types";
import { PROVIDER_LIST } from "@oneglanse/types";
import { fetchUserPromptsForWorkspace } from "../prompt/index.js";
import { getWorkspaceById } from "../workspace/index.js";
import {
	getAuthProviderForRuntimeProvider,
	getMissingRuntimeProviders,
	readAuthenticatedRuntimeProviders,
} from "./auth.js";
import { updateProviderProgress } from "./progress.js";
import { getProviderQueue } from "./queue.js";
import { redis, waitForRedis } from "./redis.js";

const AGENT_PROGRESS_TTL_SECONDS = 24 * 60 * 60;
const PROVIDER_STOP_CHANNEL = "oneglanse:agent:provider-stop";

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
	| { status: "empty" }
	| { status: "no-providers"; disconnectedProviders: Provider[] };

export function buildProviderJobId(
	jobGroupId: string,
	provider: Provider,
): string {
	return `${jobGroupId}__${provider}`;
}

export function buildProviderCancelKey(
	jobGroupId: string,
	provider: Provider,
): string {
	return `job:${jobGroupId}:cancel:${provider}`;
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
	providers?: Provider[];
}): Promise<Provider[]> {
	const {
		jobGroupId,
		prompts,
		userId,
		workspaceId,
		providers = PROVIDER_LIST,
	} = args;
	const allowedProviders = [...new Set(providers)];
	const providerJobs = buildProviderJobs().filter(({ provider }) =>
		allowedProviders.includes(provider),
	);
	const results = await Promise.allSettled(
		providerJobs.map(async ({ provider, runProviders }) => {
			await enqueueProviderJob({
				jobGroupId,
				provider,
				runProviders,
				prompts,
				user_id: userId,
				workspace_id: workspaceId,
			});
			return provider;
		}),
	);

	return results.flatMap((result, index) => {
		if (result.status === "fulfilled") {
			return [];
		}

		const failedProvider = providerJobs[index]?.provider;
		if (!failedProvider) {
			return [];
		}

		console.error(
			`[agent] failed to enqueue provider ${failedProvider}: ${toErrorMessage(result.reason)}`,
		);
		return [failedProvider];
	});
}

async function markProvidersFailed(args: {
	jobGroupId: string;
	providers: Provider[];
}): Promise<void> {
	await Promise.all(
		args.providers.map((provider) =>
			updateProviderProgress({
				jobGroupId: args.jobGroupId,
				provider,
				status: "failed",
				resultCount: 0,
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
	let allowedProviders: Provider[];
	try {
		const [loadedPrompts, workspace] = await Promise.all([
			fetchUserPromptsForWorkspace({ workspaceId }),
			getWorkspaceById({ workspaceId }),
		]);
		const { enabledProviders, selectedPromptIds } = workspace;
		prompts =
			selectedPromptIds && selectedPromptIds.length > 0
				? loadedPrompts.filter((p) => selectedPromptIds.includes(p.id))
				: loadedPrompts;
		allowedProviders = enabledProviders
			? PROVIDER_LIST.filter((provider) =>
					enabledProviders.includes(
						getAuthProviderForRuntimeProvider(provider),
					),
				)
			: [...PROVIDER_LIST];
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
	const authenticatedProviders =
		await readAuthenticatedRuntimeProviders(allowedProviders);
	if (authenticatedProviders.length === 0) {
		const disconnectedProviders =
			await getMissingRuntimeProviders(allowedProviders);
		console.warn(
			`[agent] submitAgentJobGroup: no authenticated providers found for workspace ${workspaceId} — skipping`,
		);
		return { status: "no-providers", disconnectedProviders };
	}
	await waitForRedis();

	const progress = {
		status: "pending" as const,
		updateId: 0,
		providers: Object.fromEntries(
			authenticatedProviders.map((p) => [p, "pending"]),
		) as Record<string, string>,
		results: Object.fromEntries(
			authenticatedProviders.map((p) => [p, 0]),
		) as Record<string, number>,
		stats: {
			totalPrompts: prompts.length,
			expectedResponses: prompts.length * authenticatedProviders.length,
			actualResponses: 0,
		},
	};

	await redis.set(
		`job:${jobGroupId}:result`,
		JSON.stringify(progress),
		"EX",
		AGENT_PROGRESS_TTL_SECONDS,
	);

	void enqueueProviderJobs({
		jobGroupId,
		prompts,
		userId,
		workspaceId,
		providers: authenticatedProviders,
	})
		.then(async (failedProviders) => {
			if (failedProviders.length === 0) {
				return;
			}

			await markProvidersFailed({
				jobGroupId,
				providers: failedProviders,
			});
		})
		.catch(async (err) => {
			console.error(
				`[agent] failed to queue provider jobs for job group ${jobGroupId}: ${toErrorMessage(err)}`,
			);
			await markProvidersFailed({
				jobGroupId,
				providers: authenticatedProviders,
			});
		});

	return { status: "queued", jobGroupId };
}

export async function cancelProviderRun(args: {
	jobGroupId: string;
	provider: Provider;
}): Promise<{ accepted: boolean }> {
	const { jobGroupId, provider } = args;
	const queue = getProviderQueue(provider);
	const job = await queue.getJob(buildProviderJobId(jobGroupId, provider));

	await waitForRedis();
	await redis.set(
		buildProviderCancelKey(jobGroupId, provider),
		"1",
		"EX",
		AGENT_PROGRESS_TTL_SECONDS,
	);

	if (job) {
		const state = await job.getState();
		if (state === "waiting" || state === "delayed" || state === "prioritized") {
			await job.remove();
			await updateProviderProgress({
				jobGroupId,
				provider,
				status: "stopped",
				resultCount: 0,
			});
			return { accepted: true };
		}
	}

	await redis.publish(
		PROVIDER_STOP_CHANNEL,
		JSON.stringify({ jobGroupId, provider }),
	);
	return { accepted: true };
}
