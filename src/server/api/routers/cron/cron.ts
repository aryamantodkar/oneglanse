// src/server/api/routers/cron.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/lib/error";
import { createCronForWorkspace, deleteCronForWorkspace, fetchFailedJobsForWorkspace, listCronForWorkspace, updateCronForWorkspace } from "@/server/services/cron/cron";

export const cronRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().optional(),
        cronExpression: z.string(),
        timezone: z.string().optional(),
        targetType: z.enum(["webhook", "internal"]),
        targetPayload: z.any(),
        maxAttempts: z.number().optional().default(3),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;
        const { workspaceId, name, cronExpression, timezone, targetType, targetPayload, maxAttempts } = input;

        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }
  
        if (!workspaceId || workspaceId.trim() === "") {
          throw new ValidationError("Workspace ID is undefined.");
        }

        const res = createCronForWorkspace({ workspaceId: workspaceId, userId: userId, name, cronExpression, timezone, targetType, targetPayload, maxAttempts });
        return ok(res, "Cron job created successfully.");
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        name: z.string().optional(),
        cronExpression: z.string(),
        maxAttempts: z.number().optional().default(3),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;

        const { jobId, name, cronExpression, maxAttempts } = input;

        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }

        if (!jobId) {
          throw new ValidationError("Job Id is undefined.");
        }

        const res = updateCronForWorkspace({ userId, jobId, name, cronExpression, maxAttempts });
        return ok(res, "Cron job updated successfully.");
      })
    }),

  delete: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;
        const { jobId } = input;

        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }

        if (!jobId) {
          throw new ValidationError("Job Id is undefined.");
        }

        const res = deleteCronForWorkspace({ userId, jobId });
        return ok(res, "Cron job deleted successfully.");
      })
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;
        const { workspaceId } = input;

        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }
  
        if (!workspaceId || workspaceId.trim() === "") {
          throw new ValidationError("Workspace ID is undefined.");
        }

        const res = listCronForWorkspace({ workspaceId, userId });
        return ok(res, "Fetched cron jobs for this workspace successfully.");
      })
    }),
  fetchFailedJobs: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;
        const { workspaceId } = input;
  
        if (!userId) {
          throw new AuthError("User Id is undefined.");
        }
  
        if (!workspaceId || workspaceId.trim() === "") {
          throw new ValidationError("Workspace ID is undefined.");
        }
  
        const res = fetchFailedJobsForWorkspace({ workspaceId, userId });
        return ok(res, "Fetched failed cron jobs for this workspace successfully.");
      });
    }),
});