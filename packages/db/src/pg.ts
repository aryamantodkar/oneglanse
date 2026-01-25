import { Pool } from "pg"; // your DATABASE_URL

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, 
});