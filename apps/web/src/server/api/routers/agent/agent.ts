import { z } from "zod";
import { randomUUID } from "crypto";
import { createTRPCRouter } from "../../trpc";
import { agentQueue, fetchUserPromptsForWorkspace, redis } from "@onescope/services";
import { authorizedWorkspaceProcedure } from "../../procedures";
import { ok, safeHandler } from "@onescope/errors";

export const agentRouter = createTRPCRouter({
  run: authorizedWorkspaceProcedure
    .mutation(async ({ ctx }) => {
        return safeHandler(async () => {
            const {
                user: { id: userId },
                workspaceId,
            } = ctx;

            const prompts = await fetchUserPromptsForWorkspace({ workspaceId: workspaceId!, userId: userId! });

            if (!prompts || prompts.length === 0) {
              return ok({ jobId: null as string | null, status: "empty" }, "No prompts to run.");
            }

            const jobGroupId = randomUUID();
            const createdAt = prompts[0]?.created_at ?? new Date().toISOString();
            const providers = ["openai", "anthropic", "perplexity"] as const;

            const progress = {
              status: "pending" as const,
              updateId: 0,
              providers: {
                openai: "pending",
                anthropic: "pending",
                perplexity: "pending",
              },
              results: {
                openai: 0,
                anthropic: 0,
                perplexity: 0,
              },
              stats: {
                totalPrompts: prompts.length,
                expectedResponses: prompts.length * providers.length,
                actualResponses: 0,
              },
            };

            await redis.set(
              `job:${jobGroupId}:result`,
              JSON.stringify(progress),
              "EX",
              60 * 60
            );

            await Promise.all(
              providers.map((provider) =>
                agentQueue.add("run-agent", {
                  jobGroupId,
                  provider,
                  prompts,
                  user_id: userId,
                  workspace_id: workspaceId!,
                  created_at: createdAt,
                })
              )
            );

            const jobDetails = {
                jobId: jobGroupId,
                status: "queued",
            };

            return ok(jobDetails, "Prompts Response analysed successfully.");
        })
      
    }),
  status: authorizedWorkspaceProcedure
    .input(z.object({ jobId: z.string() }))
    .output(z.object({
      status: z.enum(["pending", "completed"]),
      response: z.unknown(),
    }))
    .query(async ({ input }) => {
      const result = await redis.get(`job:${input.jobId}:result`);

      if (!result) {
        return {
          status: "pending" as const,
          response: null
        };
      }

      const parsed = JSON.parse(result);
      const status = parsed?.status === "completed" ? "completed" : "pending";

      return {
        status,
        response: parsed
      };
    })
});
