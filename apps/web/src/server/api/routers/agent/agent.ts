import { redis, submitAgentJobGroup } from "@oneglanse/services";
import { z } from "zod";
import { authorizedWorkspaceProcedure } from "../../procedures";
import { createTRPCRouter } from "../../trpc";

export const agentRouter = createTRPCRouter({
	run: authorizedWorkspaceProcedure.mutation(async ({ ctx }) => {
		const {
			user: { id: userId },
			workspaceId,
		} = ctx;

		const result = await submitAgentJobGroup({ workspaceId, userId });

		if (result.status === "empty") {
			return { jobId: null as string | null, status: "empty" as const };
		}

		return { jobId: result.jobGroupId, status: "queued" as const };
	}),

	status: authorizedWorkspaceProcedure
		.input(z.object({ jobId: z.string() }))
		.output(
			z.object({
				status: z.enum(["pending", "completed"]),
				response: z.unknown(),
			}),
		)
		.query(async ({ input }) => {
			const result = await redis.get(`job:${input.jobId}:result`);

			if (!result) {
				return { status: "pending" as const, response: null };
			}

			const parsed = JSON.parse(result);
			return {
				status: parsed?.status === "completed" ? "completed" : "pending",
				response: parsed,
			};
		}),
});
