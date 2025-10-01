import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from '@clickhouse/client';

import { env } from "@/env";
import * as schema from "./schema";
export { schema };

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export const clickhouse = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
  database: process.env.CLICKHOUSE_DB || 'analytics',
});