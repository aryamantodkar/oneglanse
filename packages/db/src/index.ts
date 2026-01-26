import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from '@clickhouse/client';

import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
};

// Only initialize if DATABASE_URL is available (skip during build)
const databaseUrl = process.env.DATABASE_URL;

const conn = databaseUrl
	? (globalForDb.conn ?? postgres(databaseUrl))
	: null;

if (conn && process.env.NODE_ENV !== "production") {
	globalForDb.conn = conn;
}

// Create db instance only if connection exists, otherwise create a proxy that throws on use
export const db = conn
	? drizzle(conn, { schema })
	: new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
			get() {
				throw new Error('DATABASE_URL environment variable is not defined');
			},
		});

export const clickhouse = createClient({
	url: process.env.CLICKHOUSE_URL || 'http://clickhouse:8123',
	username: process.env.CLICKHOUSE_USER || 'default',
	password: process.env.CLICKHOUSE_PASSWORD || 'password',
	database: process.env.CLICKHOUSE_DB || 'analytics',
});

export { schema };
export * from "./pg"
export * from "./types"