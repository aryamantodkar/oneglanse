// src/server/api/routers/cron.ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import cronParser from "cron-parser";
import { pool } from "@/server/db/pg"; // pg Pool (Node-Postgres)
import { db } from "@/server/db";
import { cronJobs, cronQueue } from "@/server/db/schema/cron";
import { eq } from "drizzle-orm";

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
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      // 1️⃣ Validate cron syntax before saving
      try {
        cronParser.parse(input.cronExpression, {
          tz: input.timezone ?? "UTC",
        });
      } catch (err) {
        throw new Error("Invalid cron expression");
      }

      // 2️⃣ Insert job into cron_jobs via Drizzle ORM
      const [jobRow] = await db
        .insert(cronJobs)
        .values({
          workspaceId: input.workspaceId,
          userId,
          name: input.name ?? null,
          cronExpression: input.cronExpression,
          timezone: input.timezone ?? "UTC",
          targetType: input.targetType,
          targetPayload: input.targetPayload,
          maxAttempts: input.maxAttempts,
        })
        .returning();

      // 3️⃣ Prepare pg_cron schedule
      const jobName = `cron_job_${jobRow?.id}`;

      if (!jobRow) throw new Error("Failed to insert cron job");
      
      // We insert into `cron_queue` when the cron triggers.
      const scheduledSQL = `
        INSERT INTO public.cron_queue ("job_id", "workspace_id", "payload", "max_attempts")
        VALUES ('${jobRow.id}','${jobRow.workspaceId}','${JSON.stringify({ ...input.targetPayload, userId }).replace(/'/g, "''")}'::jsonb,${input.maxAttempts});`;

      // 4️⃣ Schedule with pg_cron (runs on Postgres server side)
      await pool.query(
        `SELECT cron.schedule($1, $2, $3);`,
        [jobName, input.cronExpression, scheduledSQL]
      );

      return jobRow;
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
      const userId = ctx.session?.user.id;
      if (!userId) throw new Error("Unauthorized");

      // 1️⃣ Validate cron expression
      try {
        cronParser.parse(input.cronExpression, { tz: "UTC" });
      } catch {
        throw new Error("Invalid cron expression");
      }

      const rows = await db.select().from(cronJobs).where(eq(cronJobs.id, input.jobId));
      const existingJob = rows[0];    

      if (!existingJob) throw new Error("Cron job not found");

      // 3️⃣ Update pg_cron schedule if expression changed
      const jobName = `cron_job_${existingJob.id}`;

      if (existingJob.cronExpression !== input.cronExpression) {
        // Unschedule old job
        await pool.query(`SELECT cron.unschedule($1);`, [jobName]);

        // Reschedule with new cron expression
        const scheduledSQL = `INSERT INTO public.cron_queue ("job_id", "workspace_id", "payload", "max_attempts")
          VALUES ('${existingJob.id}', '${existingJob.workspaceId}', '${JSON.stringify({ ...existingJob.targetPayload, userId }).replace(/'/g, "''")}'::jsonb, ${input.maxAttempts});`;

        await pool.query(
          `SELECT cron.schedule($1, $2, $3);`,
          [jobName, input.cronExpression, scheduledSQL]
        );
      }

      // 4️⃣ Update job row
      const [updatedJob] = await db
        .update(cronJobs)
        .set({
          name: input.name ?? existingJob.name,
          cronExpression: input.cronExpression,
          maxAttempts: input.maxAttempts,
        })
        .where(eq(cronJobs.id, input.jobId))
        .returning();

      return updatedJob;
    }),

  delete: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      const jobName = `cron_job_${input.jobId}`;
      // Unschedule the pg_cron job
      await pool.query(`SELECT cron.unschedule($1);`, [jobName]);
      // Delete from cron_jobs table
      await db.delete(cronJobs).where(eq(cronJobs.id, input.jobId));
      await db.delete(cronQueue).where(eq(cronQueue.jobId, input.jobId));
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      const jobs = await db
        .select()
        .from(cronJobs)
        .where(eq(cronJobs.workspaceId, input.workspaceId));
      return jobs;
    }),
});