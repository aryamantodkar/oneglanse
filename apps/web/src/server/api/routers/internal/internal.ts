import "server-only";

import { randomUUID } from "crypto";
import { createTRPCRouter } from "@/server/api/trpc";
import {
	agentQueue,
	fetchUserPromptsForWorkspace,
	getWorkspaceById,
	redis,
} from "@oneglanse/services";
import type { Provider } from "@oneglanse/types";
import { ALL_PROVIDERS_JSON } from "@oneglanse/utils";
import { z } from "zod";
import { internalProcedure } from "../../procedures";

export const internalRouter = createTRPCRouter({
	runPrompts: internalProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const { workspaceId, userId } = input;

			const prompts = await fetchUserPromptsForWorkspace({
				workspaceId,
				userId,
			});

			if (!prompts || prompts.length === 0) {
				return { jobId: null as string | null, status: "empty" as const };
			}

			const jobGroupId = randomUUID();

			// Fetch workspace and parse enabled providers
			const workspace = await getWorkspaceById({ workspaceId });
			const enabledProvidersJson =
				workspace.enabledProviders ?? ALL_PROVIDERS_JSON;
			const enabledProviders = JSON.parse(enabledProvidersJson) as Provider[];

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
					agentQueue.add("run-agent", {
						jobGroupId,
						provider,
						prompts,
						user_id: userId,
						workspace_id: workspaceId,
					}),
				),
			);

			return { jobId: jobGroupId, status: "queued" as const };
		}),
});
