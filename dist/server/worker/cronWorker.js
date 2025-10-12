// src/server/db/pg.ts
import { Pool } from "pg";

// src/env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
var env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development")
  },
  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },
  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true
});

// src/server/db/pg.ts
var pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5
  // optional, number of worker connections
});

// src/server/db/schema/cron.ts
import {
  pgTable,
  text,
  uuid,
  jsonb,
  boolean,
  integer,
  timestamp,
  index
} from "drizzle-orm/pg-core";
var cronJobs = pgTable("cron_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name"),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").default("UTC"),
  targetType: text("target_type").notNull(),
  // 'webhook' | 'internal'
  targetPayload: jsonb("target_payload").$type(),
  enabled: boolean("enabled").default(true),
  maxAttempts: integer("max_attempts").default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});
var cronQueue = pgTable(
  "cron_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => cronJobs.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    payload: jsonb("payload").$type(),
    attempts: integer("attempts").default(0),
    maxAttempts: integer("max_attempts").default(3),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    processed: boolean("processed").default(false),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => ({
    idxNextRun: index("idx_cron_queue_next_run").on(
      table.nextRunAt,
      table.processed,
      table.attempts
    )
  })
);
var jobRuns = pgTable("job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => cronJobs.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status"),
  // success | failed
  httpStatus: integer("http_status"),
  error: text("error"),
  output: jsonb("output").$type()
});

// src/server/worker/cronWorker.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
var rawConn = postgres(env.DATABASE_URL);
var db = drizzle(rawConn);
async function claimNextJob() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      UPDATE cron_queue
      SET locked_at = now()
      WHERE id = (
        SELECT id FROM cron_queue
        WHERE processed = false
          AND (next_run_at IS NULL OR next_run_at <= now())
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *;
    `);
    return res.rows[0];
  } finally {
    client.release();
  }
}
async function processJob(job) {
  if (!job) return;
  try {
    if (job.payload?.type === "runPrompts") {
      const { workspaceId } = job;
      console.log("Running prompts for workspace:", workspaceId);
    } else if (job.payload?.type === "webhook") {
      const { url, method = "POST", body } = job.payload;
      await fetch(url, { method, body: JSON.stringify(body) });
    }
    await pool.query(
      `INSERT INTO job_runs (jobId, workspaceId, startedAt, finishedAt, status, output)
       VALUES ($1, $2, now(), now(), 'success', $3::jsonb)`,
      [job.jobId, job.workspaceId, JSON.stringify({ result: "ok" })]
    );
    await pool.query(
      `UPDATE cron_queue SET processed = true WHERE id = $1`,
      [job.id]
    );
  } catch (err) {
    const attempts = (job.attempts || 0) + 1;
    const maxAttempts = job.max_attempts || 3;
    if (attempts >= maxAttempts) {
      await pool.query(
        `INSERT INTO job_runs (jobId, workspaceId, startedAt, finishedAt, status, error)
         VALUES ($1, $2, now(), now(), 'failed', $3)`,
        [job.jobId, job.workspaceId, String(err.message || err)]
      );
      await pool.query(
        `UPDATE cron_queue SET processed = true, last_error = $2, attempts = $1 WHERE id = $3`,
        [attempts, String(err.message || err), job.id]
      );
    } else {
      const backoffSeconds = Math.pow(attempts, 2) * 60;
      await pool.query(
        `UPDATE cron_queue SET attempts = $1, next_run_at = now() + ($2 || ' seconds')::interval, last_error = $3 WHERE id = $4`,
        [attempts, backoffSeconds, String(err.message || err), job.id]
      );
    }
  }
}
async function mainLoop() {
  while (true) {
    const job = await claimNextJob();
    if (!job) {
      await new Promise((r) => setTimeout(r, 1e3));
      continue;
    }
    await processJob(job);
  }
}
mainLoop().catch((err) => {
  console.error("Cron worker crashed:", err);
  process.exit(1);
});
