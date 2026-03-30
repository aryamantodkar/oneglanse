import { redis } from "@oneglanse/services";
import { z } from "zod";
import { createRateLimiter } from "../../middleware/rateLimit";
import {
	authorizedWorkspaceProcedure,
} from "../../procedures";
import { submitAgentRun } from "../_shared/submitAgentRun";
import { createTRPCRouter } from "../../trpc";

export const agentRouter = createTRPCRouter({
	run: authorizedWorkspaceProcedure
		.use(createRateLimiter("agent.run", { limit: 3, windowSecs: 60 }))
		.mutation(async ({ ctx }) => {
			const {
				user: { id: userId },
				workspaceId,
			} = ctx;

			return submitAgentRun({ workspaceId, userId });
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
