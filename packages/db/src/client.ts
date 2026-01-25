import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@clickhouse/client";

import * as schema from "./schema";

export type DatabaseConfig = {
  databaseUrl: string;
  clickhouse?: {
    url?: string;
    username?: string;
    password?: string;
    database?: string;
  };
};

export function createDb(config: DatabaseConfig) {
  const conn = postgres(config.databaseUrl);
  return drizzle(conn, { schema });
}

export function createClickhouse(config?: DatabaseConfig["clickhouse"]) {
  return createClient({
    url: config?.url ?? process.env.CLICKHOUSE_URL ?? "http://clickhouse:8123",
    username: config?.username ?? process.env.CLICKHOUSE_USER ?? "default",
    password: config?.password ?? process.env.CLICKHOUSE_PASSWORD ?? "password",
    database: config?.database ?? process.env.CLICKHOUSE_DB ?? "analytics",
  });
}

export { schema };
export type { postgres };
