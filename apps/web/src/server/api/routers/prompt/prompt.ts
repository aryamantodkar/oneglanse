import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { ValidationError, ok, safeHandler } from "@onescope/errors";
import {
	fetchPromptSourcesForWorkspace,
	fetchUserPromptsForWorkspace,
	storePromptsForWorkspace,
} from "@onescope/services";
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
			return safeHandler(async () => {
				const { prompts } = input;

				const {
					user: { id: userId },
					workspaceId,
				} = ctx;

				if (!prompts?.length) {
					throw new ValidationError("Missing required fields: Prompts");
				}

				const res = await storePromptsForWorkspace({
					prompts: prompts,
					workspaceId: workspaceId,
					userId: userId,
				});
				return ok(res, "Prompts stored successfully.");
			});
		}),

	fetchPromptSources: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return safeHandler(async () => {
			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			const res = await fetchPromptSourcesForWorkspace({
				workspaceId: workspaceId,
				userId: userId,
			});

			return ok(res, "Fetched prompt sources successfully.");
		});
	}),

	fetchUserPrompts: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return safeHandler(async () => {
			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			const res = await fetchUserPromptsForWorkspace({
				workspaceId: workspaceId,
				userId: userId,
			});

			return ok(res, "Fetched user prompts successfully.");
		});
	}),
});
