import { z } from "zod";
import { createTRPCRouter, llmRateLimiter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/lib/error";
import { askPromptsForWorkspace, fetchPromptResponsesForWorkspace, fetchUserPromptsForWorkspace, storePromptsForWorkspace } from "@/server/services/prompt/prompt";

export const promptRouter = createTRPCRouter({
  ask: llmRateLimiter
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

        const res = await askPromptsForWorkspace({ workspaceId: workspaceId!, userId: userId! });
        return ok(res, "Prompts asked successfully.");
      })
    }),
  store: protectedProcedure
    .input(
      z.object({
        prompts: z.array(z.string()),
        workspaceId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { prompts, workspaceId } = input;
        const userId = ctx.session?.user.id;

        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new ValidationError("Workspace ID is undefined.");
        }

        const res = await storePromptsForWorkspace({ prompts: prompts!, workspaceId: workspaceId!, userId: userId! });
        return ok(res, "Prompts stored successfully.");
      })
    }),
  fetchPromptResponses: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { workspaceId } = input;
        const userId = ctx.session?.user.id;
    
        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new ValidationError("Workspace ID is undefined.");
        }

        const res = await fetchPromptResponsesForWorkspace({ workspaceId: workspaceId!, userId: userId!});

        return ok(res, "Fetched prompt responses successfully.");
      })
    }),
  fetchUserPrompts: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const { workspaceId } = input;
        const userId = ctx.session?.user.id;
    
        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new ValidationError("Workspace ID is undefined.");
        }
        
        const res = await fetchUserPromptsForWorkspace({ workspaceId: workspaceId!, userId: userId! });

        return ok(res, "Fetched user prompts successfully.");
      })
    }),
});