import { z } from "zod";
import { analysisRateLimiter, createTRPCRouter } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/lib/error";
import { analyseCompetitorsForWorkspace, fetchCompetitorsForWorkspace } from "@/server/services/competitors/competitors";

export const competitorsRouter = createTRPCRouter({
  analyseCompetitors: analysisRateLimiter
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

      const res = await analyseCompetitorsForWorkspace({ workspaceId: workspaceId, userId: userId })
      return ok(res, "Fetched competitors successfully.");
    })
  }),
  fetchCompetitors: analysisRateLimiter
  .input(
    z.object({
      workspaceId: z.string(),
      userId: z.string().optional()
    })
  )
  .query(async ({ input, ctx }) => {
    return safeHandler(async () => {
      const { workspaceId, userId: inputUserId } = input;
      const userId = inputUserId ?? ctx.session?.user.id;

      if (!userId) {
        throw new AuthError("User Id is undefined.");
      }
      
      if (!workspaceId || workspaceId.trim() === "") {
        throw new ValidationError("Workspace ID is undefined.");
      }

      const res = await fetchCompetitorsForWorkspace({ workspaceId: workspaceId, userId: userId })
      return ok(res, "Fetched competitors successfully.");
    })
  })
});

