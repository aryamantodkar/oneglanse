import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: ["../../packages/db/src/schema/index.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
