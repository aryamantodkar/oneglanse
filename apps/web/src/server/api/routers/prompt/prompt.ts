import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { ValidationError } from "@oneglanse/errors";
import {
	fetchPromptSourcesForWorkspace,
	fetchUserPromptsForWorkspace,
	storePromptsForWorkspace,
} from "@oneglanse/services";
import { z } from "zod";
import { authorizedWorkspaceProcedure } from "../../procedures";

export const promptRouter = createTRPCRouter({
	store: authorizedWorkspaceProcedure
		.input(
			z.object({
				prompts: z.array(z.string()),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { prompts } = input;

			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			if (!prompts?.length) {
				throw new ValidationError("Missing required fields: Prompts");
			}

			return storePromptsForWorkspace({
				prompts: prompts,
				workspaceId: workspaceId,
				userId: userId,
			});
		}),

	fetchPromptSources: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const {
			user: { id: userId },
			workspaceId,
		} = ctx;

		return fetchPromptSourcesForWorkspace({
			workspaceId: workspaceId,
			userId: userId,
		});
	}),

	fetchUserPrompts: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const {
			user: { id: userId },
			workspaceId,
		} = ctx;

		return fetchUserPromptsForWorkspace({
			workspaceId: workspaceId,
			userId: userId,
		});
	}),
});
