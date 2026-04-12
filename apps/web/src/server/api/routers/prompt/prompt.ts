import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import {
	fetchPromptSourcesForWorkspace,
	fetchUserPromptsForWorkspace,
	storePromptsForWorkspace,
} from "@oneglanse/services";
import { z } from "zod";
import { createRateLimiter } from "../../middleware/rateLimit";
import { authorizedWorkspaceProcedure } from "../../procedures";

export const promptRouter = createTRPCRouter({
	store: authorizedWorkspaceProcedure
		.input(
			z.object({
				prompts: z.array(z.string().trim().min(1)).max(100),
			}),
		)
		.use(createRateLimiter("prompt.store", { limit: 20, windowSecs: 60 }))
		.mutation(async ({ input, ctx }) => {
			const { prompts } = input;

			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			return storePromptsForWorkspace({
				prompts: prompts,
				workspaceId: workspaceId,
				userId: userId,
			});
		}),

	fetchPromptSources: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;

		return fetchPromptSourcesForWorkspace({ workspaceId });
	}),

	fetchUserPrompts: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;

		return fetchUserPromptsForWorkspace({
			workspaceId,
		});
	}),
});
