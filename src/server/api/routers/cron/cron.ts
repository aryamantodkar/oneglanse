// src/server/api/routers/cron.ts
import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { AuthError, ok, safeHandler, ValidationError } from "@/lib/error";
import { createCronForWorkspace, deleteCronForWorkspace, fetchFailedJobsForWorkspace, listCronForWorkspace, updateCronForWorkspace } from "@/server/services/cron/cron";
import { authorizedWorkspaceProcedure, protectedProcedure } from "../../procedures";

export const cronRouter = createTRPCRouter({
  create: authorizedWorkspaceProcedure
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
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;
        
        const { name, cronExpression, timezone, targetType, targetPayload, maxAttempts } = input;

        const res = await createCronForWorkspace({ workspaceId: workspaceId, userId: userId, name, cronExpression, timezone, targetType, targetPayload, maxAttempts });
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
        const {
          user: { id: userId }
        } = ctx;

        const { jobId, name, cronExpression, maxAttempts } = input;

        if (!jobId) {
          throw new ValidationError("Job Id is undefined.");
        }

        const res = await updateCronForWorkspace({ userId, jobId, name, cronExpression, maxAttempts });
        return ok(res, "Cron job updated successfully.");
      })
    }),

  delete: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.user.id;
        const { jobId } = input;

        if (!jobId) {
          throw new ValidationError("Job Id is undefined.");
        }

        const res = await deleteCronForWorkspace({ userId, jobId });
        return ok(res, "Cron job deleted successfully.");
      })
    }),

  list: authorizedWorkspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return safeHandler(async () => {
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;

        const res = await listCronForWorkspace({ workspaceId, userId });
        return ok(res, "Fetched cron jobs for this workspace successfully.");
      })
    }),
  fetchFailedJobs: authorizedWorkspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx }) => {
      return safeHandler(async () => {
        const {
          user: { id: userId },
          workspaceId,
        } = ctx;
  
        const res = await fetchFailedJobsForWorkspace({ workspaceId, userId });
        return ok(res, "Fetched failed cron jobs for this workspace successfully.");
      });
    }),
});