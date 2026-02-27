import { drizzle } from "drizzle-orm/postgres-js";
import { Pool } from "pg";
import postgres from "postgres";

import * as schema from "../schema/index.js";
import { postgresConfig } from "../config/postgres.js";
import { env } from "../env.js";

const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
	pool: Pool | undefined;
};

const { databaseUrl } = postgresConfig;

const conn = databaseUrl ? (globalForDb.conn ?? postgres(databaseUrl)) : null;

if (conn && env.NODE_ENV !== "production") {
	globalForDb.conn = conn;
}

// Create db instance only if connection exists, otherwise create a proxy that throws on use
export const db = conn
	? drizzle(conn, { schema })
	: new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
			get() {
				throw new Error("DATABASE_URL environment variable is not defined");
			},
		});

// Raw pg Pool — used for pg_cron SQL calls (cron.schedule / cron.unschedule)
export const pool = databaseUrl
	? (globalForDb.pool ??
		new Pool({
			connectionString: databaseUrl,
			max: 5,
		}))
	: new Proxy({} as Pool, {
			get() {
				throw new Error("DATABASE_URL environment variable is not defined");
			},
		});

if (databaseUrl && env.NODE_ENV !== "production") {
	globalForDb.pool = pool as Pool;
}
