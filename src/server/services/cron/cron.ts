import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import cronParser from "cron-parser";
import { pool } from "@/server/db/pg"; // pg Pool (Node-Postgres)
import { db } from "@/server/db";
import { cronJobs, cronQueue } from "@/server/db/schema/cron";
import { eq } from "drizzle-orm";
import { AuthError, DatabaseError, NotFoundError, ok, safeHandler, ValidationError } from "@/server/error";

export async function createCronForWorkspace(args: {
    workspaceId: string;
    userId: string;
    name?: string;
    cronExpression: string;
    timezone?: string;
    targetType: "webhook" | "internal";
    targetPayload: any;
    maxAttempts?: number; 
  }) {
    const {
      workspaceId,
      userId,
      name,
      cronExpression,
      timezone,
      targetType,
      targetPayload,
      maxAttempts = 3, 
    } = args;

    try {
      cronParser.parse(cronExpression, {
        tz: timezone ?? "UTC",
      });
    } catch (err) {
      throw new ValidationError("Invalid cron expression.");
    }

    // 2️⃣ Insert job into cron_jobs via Drizzle ORM
    const [jobRow] = await db
      .insert(cronJobs)
      .values({
        workspaceId: workspaceId,
        userId,
        name: name ?? null,
        cronExpression: cronExpression,
        timezone: timezone ?? "UTC",
        targetType: targetType,
        targetPayload: targetPayload,
        maxAttempts: maxAttempts,
      })
      .returning();

      if (!jobRow) throw new DatabaseError("Failed to insert cron job", { table: "cron_jobs", operation: "insert" });
    // 3️⃣ Prepare pg_cron schedule
    const jobName = `cron_job_${jobRow?.id}`;
    
    // We insert into `cron_queue` when the cron triggers.
    const scheduledSQL = `
      INSERT INTO public.cron_queue ("job_id", "workspace_id", "payload", "max_attempts")
      VALUES ('${jobRow?.id}','${jobRow?.workspaceId}','${JSON.stringify({ ...targetPayload, userId }).replace(/'/g, "''")}'::jsonb,${maxAttempts});`;

    // 4️⃣ Schedule with pg_cron (runs on Postgres server side)
    await pool.query(
      `SELECT cron.schedule($1, $2, $3);`,
      [jobName, cronExpression, scheduledSQL]
    );

    return jobRow;
  }


  export async function updateCronForWorkspace(args: {
    userId: string;
    jobId: string;
    name?: string;
    cronExpression: string;
    maxAttempts?: number; 
  }) {
    const {
      userId,
      jobId,
      name,
      cronExpression,
      maxAttempts = 3, 
    } = args;

    try {
      cronParser.parse(cronExpression, { tz: "UTC" });
    } catch {
      throw new ValidationError("Invalid cron expression.");
    }

    const rows = await db.select().from(cronJobs).where(eq(cronJobs.id, jobId));
    const existingJob = rows[0];    

    if (!existingJob){
      throw new NotFoundError(`Cron job with ID ${jobId} not found.`);
    }

    // 3️⃣ Update pg_cron schedule if expression changed
    const jobName = `cron_job_${existingJob.id}`;

    if (existingJob.cronExpression !== cronExpression) {
      // Unschedule old job
      await pool.query(`SELECT cron.unschedule($1);`, [jobName]);

      // Reschedule with new cron expression
      const scheduledSQL = `INSERT INTO public.cron_queue ("job_id", "workspace_id", "payload", "max_attempts")
        VALUES ('${existingJob.id}', '${existingJob.workspaceId}', '${JSON.stringify({ ...existingJob.targetPayload, userId }).replace(/'/g, "''")}'::jsonb, ${maxAttempts});`;

      await pool.query(
        `SELECT cron.schedule($1, $2, $3);`,
        [jobName, cronExpression, scheduledSQL]
      );
    }

    // 4️⃣ Update job row
    const [updatedJob] = await db
      .update(cronJobs)
      .set({
        name: name ?? existingJob.name,
        cronExpression: cronExpression,
        maxAttempts: maxAttempts,
      })
      .where(eq(cronJobs.id, jobId))
      .returning();

    return updatedJob;
  }

  export async function deleteCronForWorkspace(args: {
    userId: string;
    jobId: string;
  }) {
    const { jobId } = args;
    
    const jobName = `cron_job_${jobId}`;

    await pool.query(`SELECT cron.unschedule($1);`, [jobName]);

    await db.delete(cronJobs).where(eq(cronJobs.id, jobId));
    await db.delete(cronQueue).where(eq(cronQueue.jobId, jobId));

    return null;
  }

  export async function listCronForWorkspace(args: {
    workspaceId: string;
    userId: string;
  }) {
    const { workspaceId } = args;

    const jobs = await db
        .select()
        .from(cronJobs)
        .where(eq(cronJobs.workspaceId, workspaceId));

    return jobs;
  }

  export async function fetchFailedJobsForWorkspace(args: {
    workspaceId: string;
    userId: string;
  }) {
    const { workspaceId, userId } = args;

    const result = await pool.query(
        `SELECT job_id, workspace_id, error, finished_at
            FROM public.job_runs
            WHERE status = 'failed' AND workspace_id = $1
            ORDER BY finished_at DESC`,
        [workspaceId]
    );

    return result.rows;
  }