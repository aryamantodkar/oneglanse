import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { submitAgentJobGroup } from "@oneglanse/services";
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

			const result = await submitAgentJobGroup({ workspaceId, userId });

			if (result.status === "empty") {
				return { jobId: null as string | null, status: "empty" as const };
			}

			return { jobId: result.jobGroupId, status: "queued" as const };
		}),
});
