import "server-only";

import { createDb, createClickhouse, schema } from "@onescope/db";
import { env } from "@/env";

export { schema };

// Re-export types from the db package
export type * from "@onescope/db";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
};

export const db = globalForDb.db ?? createDb({ databaseUrl: env.DATABASE_URL });
if (env.NODE_ENV !== "production") globalForDb.db = db;

export const clickhouse = createClickhouse();
