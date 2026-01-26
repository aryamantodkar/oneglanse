import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPgPool(): Pool {
  if (_pool) return _pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  _pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
  });

  return _pool;
}