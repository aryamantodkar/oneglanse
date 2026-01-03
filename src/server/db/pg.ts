// src/server/db/pgPool.ts
import "server-only";

import { Pool } from "pg";
import { env } from "@/env"; // your DATABASE_URL

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5, 
});