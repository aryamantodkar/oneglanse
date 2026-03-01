import { randomUUID } from "crypto";
import type { Provider } from "@oneglanse/types";
import { ALL_PROVIDERS_JSON } from "@oneglanse/utils";
import { fetchUserPromptsForWorkspace } from "../prompt/index.js";
import { getWorkspaceById } from "../workspace/index.js";
import { getProviderQueue } from "./queue.js";
import { redis } from "./redis.js";

export type SubmitAgentJobResult =
	| { status: "queued"; jobGroupId: string }
	| { status: "empty" };

/**
 * Fetches the workspace's prompts and enabled providers, then submits one
 * BullMQ job per provider. Sets the Redis progress key so the client can
 * poll for status. Returns "empty" if no prompts are configured.
 */
export async function submitAgentJobGroup(args: {
	workspaceId: string;
	userId: string;
}): Promise<SubmitAgentJobResult> {
	const { workspaceId, userId } = args;

	const prompts = await fetchUserPromptsForWorkspace({ workspaceId, userId });
	if (!prompts || prompts.length === 0) {
		console.warn(`[agent] submitAgentJobGroup: no prompts found for workspace ${workspaceId} — skipping`);
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
		results: Object.fromEntries(
			enabledProviders.map((p) => [p, 0]),
		) as Record<string, number>,
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
		60 * 60,
	);

	await Promise.all(
		enabledProviders.map((provider) =>
			getProviderQueue(provider).add("run-agent", {
				jobGroupId,
				provider,
				prompts,
				user_id: userId,
				workspace_id: workspaceId,
			}),
		),
	);

	return { status: "queued", jobGroupId };
}
