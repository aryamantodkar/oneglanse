import { z } from "zod";
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
        
            const job = await agentQueue.add("run-agent", {
                userId,
                workspaceId,
                prompts
            });
    
            const jobDetails = {
                jobId: job.id,
                status: "queued",
            };

            return ok(jobDetails, "Prompts Response analysed successfully.");
        })
      
    }),
  status: authorizedWorkspaceProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const result = await redis.get(`job:${input.jobId}:result`);
  
      if (!result) {
        return { status: "running" };
      }
  
      return JSON.parse(result);
    })
});