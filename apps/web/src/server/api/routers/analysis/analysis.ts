import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { ok, safeHandler } from "@onescope/errors";
import { analysePromptsForWorkspace, fetchAnalysedPrompts } from "@onescope/services";
import { authorizedWorkspaceProcedure } from "../../procedures";

export const analysisRouter = createTRPCRouter({
  analyzeMetrics: authorizedWorkspaceProcedure
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
  fetchAnalysis: authorizedWorkspaceProcedure
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

