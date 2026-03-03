import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { z } from "zod";
import { internalProcedure } from "../../procedures";
import { submitAgentRun } from "../_shared/submitAgentRun";

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
			return submitAgentRun({ workspaceId, userId });
		}),
});
