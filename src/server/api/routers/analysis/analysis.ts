import { z } from "zod";
import { analysisRateLimiter, createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/lib/error";
import { analysePromptsForWorkspace } from "@/server/services/analysis/analysis";

export const analysisRouter = createTRPCRouter({
  analyzeMetrics: analysisRateLimiter
  .input(
    z.object({
      workspaceId: z.string(),
      userId: z.string().optional()
    })
  )
  .mutation(async ({ input, ctx }) => {
    return safeHandler(async () => {
      const { workspaceId, userId: inputUserId } = input;
      const userId = inputUserId ?? ctx.session?.user.id;

      if (!userId) {
        throw new AuthError("User Id is undefined.");
      }
      
      if (!workspaceId || workspaceId.trim() === "") {
        throw new ValidationError("Workspace ID is undefined.");
      }

      console.log("Calling Analysis service...");
      const res = await analysePromptsForWorkspace({ workspaceId: workspaceId, userId: userId })
      return ok(res, "Prompts Response analysed successfully.");
    })
  }),
});

