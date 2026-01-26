import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@clickhouse/client";
import * as schema from "./schema";

let _conn: postgres.Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;
let _clickhouse: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (_db) return _db;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  _conn = _conn ?? postgres(databaseUrl);
  _db = drizzle(_conn, { schema });

  return _db;
}

export function getClickhouse() {
  if (_clickhouse) return _clickhouse;

  _clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://clickhouse:8123",
    username: process.env.CLICKHOUSE_USER ?? "default",
    password: process.env.CLICKHOUSE_PASSWORD ?? "password",
    database: process.env.CLICKHOUSE_DB ?? "analytics",
  });

  return _clickhouse;
}

export { schema };
export * from "./types";
export * from "./pg";
export type OnescopeDb = PostgresJsDatabase<typeof schema>;