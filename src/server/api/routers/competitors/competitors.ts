import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/lib/error";
import { analyseCompetitorsForWorkspace, fetchCompetitorsForWorkspace } from "@/server/services/competitors/competitors";
import { analysisRateLimiter } from "../../procedures";

export const competitorsRouter = createTRPCRouter({
  analyseCompetitors: analysisRateLimiter
  .input(
    z.object({
      workspaceId: z.string()
    })
  )
  .mutation(async ({ ctx }) => {
    return safeHandler(async () => {
      const {
        user: { id: userId },
        workspaceId,
      } = ctx;

      const res = await analyseCompetitorsForWorkspace({ workspaceId: workspaceId, userId: userId })
      return ok(res, "Fetched competitors successfully.");
    })
  }),
  fetchCompetitors: analysisRateLimiter
  .input(
    z.object({
      workspaceId: z.string()
    })
  )
  .query(async ({ ctx }) => {
    return safeHandler(async () => {
      const {
        user: { id: userId },
        workspaceId,
      } = ctx;

      const res = await fetchCompetitorsForWorkspace({ workspaceId: workspaceId, userId: userId })
      return ok(res, "Fetched competitors successfully.");
    })
  })
});

