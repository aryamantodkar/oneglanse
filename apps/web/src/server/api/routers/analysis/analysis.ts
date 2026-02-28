import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import {
	analysePromptsForWorkspace,
	fetchAnalysedPrompts,
} from "@oneglanse/services";
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
			return analysePromptsForWorkspace({
				workspaceId: ctx.workspaceId,
				analyzeAll: input.analyzeAll ?? true,
			});
		}),

	fetchAnalysis: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return fetchAnalysedPrompts({ workspaceId: ctx.workspaceId });
	}),
});
