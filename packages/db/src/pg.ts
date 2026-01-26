import { Pool } from "pg";

const globalForPool = globalThis as unknown as {
  pool: Pool | undefined;
};

// Only initialize if DATABASE_URL is available (skip during build)
export const pool = process.env.DATABASE_URL
  ? (globalForPool.pool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }))
  : new Proxy({} as Pool, {
      get() {
        throw new Error('DATABASE_URL environment variable is not defined');
      },
    });

if (process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  globalForPool.pool = pool as Pool;
}