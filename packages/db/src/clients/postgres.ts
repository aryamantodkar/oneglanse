import { drizzle } from "drizzle-orm/postgres-js";
import { Pool } from "pg";
import postgres from "postgres";

import * as schema from "../schema/index.js";
import { getRequiredDatabaseUrl } from "../config/postgres.js";
import { env } from "../env.js";

const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
	pool: Pool | undefined;
};

const databaseUrl = getRequiredDatabaseUrl();
const conn = globalForDb.conn ?? postgres(databaseUrl);

if (env.NODE_ENV !== "production") {
	globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });

// Raw pg Pool — used for pg_cron SQL calls (cron.schedule / cron.unschedule)
export const pool =
	globalForDb.pool ??
	new Pool({
		connectionString: databaseUrl,
		max: 5,
	});

if (env.NODE_ENV !== "production") {
	globalForDb.pool = pool as Pool;
}
