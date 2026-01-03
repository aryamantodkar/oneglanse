import "server-only";

import {
  pgTable,
  text,
  uuid,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ---------- cron_jobs ----------
export const cronJobs = pgTable("cron_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name"),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").default("UTC"),
  targetType: text("target_type").notNull(), // 'webhook' | 'internal'
  targetPayload: jsonb("target_payload").$type<{
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    type?: string;
    params?: Record<string, unknown>;
    userId?: string;
  }>(),
  enabled: boolean("enabled").default(true),
  maxAttempts: integer("max_attempts").default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});


export const cronQueue = pgTable("cron_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => cronJobs.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  processed: boolean("processed").default(false),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------- job_runs ----------
export const jobRuns = pgTable("job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .references(() => cronJobs.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status"), // success | failed
  httpStatus: integer("http_status"),
  error: text("error"),
  output: jsonb("output").$type<Record<string, unknown>>(),
});