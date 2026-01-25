import "server-only";

import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/server/error";
import { analysePromptsForWorkspace, fetchAnalysedPrompts } from "@/server/services/analysis/analysis";
import { analysisRateLimiter } from "../../procedures";

export const analysisRouter = createTRPCRouter({
  analyzeMetrics: analysisRateLimiter
  .mutation(async ({ ctx }) => {
    return safeHandler(async () => {
      const {
        user: { id: userId },
        workspaceId,
      } = ctx;

      const res = await analysePromptsForWorkspace({ workspaceId: workspaceId, userId: userId })
      return ok(res, "Prompts Response analysed successfully.");
    })
  }),
  fetchAnalysis: analysisRateLimiter
    .query(async ({ ctx }) => {
      return safeHandler(async () => {
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;

        const res = await fetchAnalysedPrompts({ workspaceId: workspaceId, userId: userId })
        return ok(res, "Fetched analysed prompt data successfully.");
      })
  }),
});

