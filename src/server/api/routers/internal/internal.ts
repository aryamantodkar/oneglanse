import "server-only";

import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { AuthError, safeHandler, ok, ValidationError } from "@/server/error";
import { runPromptPipeline } from "@/server/services/runner/runner";
import { internalProcedure } from "../../procedures";

export const internalRouter = createTRPCRouter({
  runPrompts: internalProcedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { workspaceId, userId } = input;

        const membership = await ctx.db.query.workspaceMembers.findFirst({
          where: (wm, { eq, and, isNull }) =>
            and(
              eq(wm.workspaceId, workspaceId),
              eq(wm.userId, userId),
              isNull(wm.deletedAt)
            ),
        });

        if (!membership) {
          throw new AuthError(
            "User does not have access to this workspace."
          );
        }

        return await runPromptPipeline({
          workspaceId,
          userId,
        });
      });
    })
  });