import "server-only";

import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { ok, safeHandler } from "@onescope/errors";
import { fetchPromptResponsesForWorkspace, fetchUserPromptsForWorkspace, storePromptsForWorkspace, fetchPromptSourcesForWorkspace } from "@onescope/services";
import { authorizedWorkspaceProcedure } from "../../procedures";

export const promptRouter = createTRPCRouter({
  store: authorizedWorkspaceProcedure
    .input(
      z.object({
        prompts: z.array(z.string())
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { prompts } = input;

        const {
          user: { id: userId },
          workspaceId,
        } = ctx;

        const res = await storePromptsForWorkspace({ prompts: prompts!, workspaceId: workspaceId!, userId: userId! });
        return ok(res, "Prompts stored successfully.");
      })
    }),
  fetchPromptResponses: authorizedWorkspaceProcedure
    .query(async ({ ctx }) => {
      return safeHandler(async () => {
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;

        const res = await fetchPromptResponsesForWorkspace({ workspaceId: workspaceId!, userId: userId!});

        return ok(res, "Fetched prompt responses successfully.");
      })
    }),

  fetchPromptSources: authorizedWorkspaceProcedure
    .query(async ({ ctx }) => {
      return safeHandler(async () => {
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;

        const res = await fetchPromptSourcesForWorkspace({ workspaceId: workspaceId!, userId: userId!});

        return ok(res, "Fetched prompt sources successfully.");
      })
    }),

  fetchUserPrompts: authorizedWorkspaceProcedure
    .query(async ({ ctx }) => {
      return safeHandler(async () => {
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;
  
        const res = await fetchUserPromptsForWorkspace({ workspaceId: workspaceId!, userId: userId! });

        return ok(res, "Fetched user prompts successfully.");
      })
    }),
});