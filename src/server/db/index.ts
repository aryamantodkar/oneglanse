import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from '@clickhouse/client';

import { env } from "@/env";
import * as schema from "./schema";
export { schema };


const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
export const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://clickhouse:8123',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
  database: process.env.CLICKHOUSE_DB || 'analytics',
});