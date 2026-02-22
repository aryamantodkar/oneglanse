import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import {
	analysePromptsForWorkspace,
	fetchAnalysedPrompts,
} from "@onescope/services";
import { z } from "zod";
import { authorizedWorkspaceProcedure } from "../../procedures";

export const analysisRouter = createTRPCRouter({
	analyzeMetrics: authorizedWorkspaceProcedure
		.input(
			z.object({
				analyzeAll: z.boolean().optional().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const {
				workspaceId,
				user: { id: userId },
			} = ctx;

			const { analyzeAll } = input;

			return analysePromptsForWorkspace({
				workspaceId,
				userId,
				analyzeAll: analyzeAll ?? true,
			} as Parameters<typeof analysePromptsForWorkspace>[0]);
		}),

	fetchAnalysis: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const {
			user: { id: userId },
			workspaceId,
		} = ctx;

		return fetchAnalysedPrompts({
			workspaceId: workspaceId,
			userId: userId,
		});
	}),
});
