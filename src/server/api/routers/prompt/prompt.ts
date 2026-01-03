import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/server/error";
import { askPromptsForWorkspace, fetchPromptResponsesForWorkspace, fetchUserPromptsForWorkspace, storePromptsForWorkspace } from "@/server/services/prompt/prompt";
import { authorizedWorkspaceProcedure, llmRateLimiter, protectedProcedure } from "../../procedures";

export const promptRouter = createTRPCRouter({
  ask: llmRateLimiter
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

        const res = await askPromptsForWorkspace({ workspaceId: workspaceId!, userId: userId! });
        return ok(res, "Prompts asked successfully.");
      })
    }),
  store: authorizedWorkspaceProcedure
    .input(
      z.object({
        prompts: z.array(z.string()),
        workspaceId: z.string(),
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
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
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
  fetchUserPrompts: authorizedWorkspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
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