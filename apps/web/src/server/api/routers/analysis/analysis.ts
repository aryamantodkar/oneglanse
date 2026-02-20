import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { ok, safeHandler } from "@onescope/errors";
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
			return safeHandler(async () => {
				const {
					workspaceId,
					user: { id: userId },
				} = ctx;

				const { analyzeAll } = input;

				const res = await analysePromptsForWorkspace({
					workspaceId,
					userId,
					analyzeAll: analyzeAll ?? true,
				} as Parameters<typeof analysePromptsForWorkspace>[0]);
				return ok(res, "Prompts Response analysed successfully.");
			});
		}),
	fetchAnalysis: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return safeHandler(async () => {
			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			const res = await fetchAnalysedPrompts({
				workspaceId: workspaceId,
				userId: userId,
			});
			return ok(res, "Fetched analysed prompt data successfully.");
		});
	}),
});
