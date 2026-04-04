import { z } from "zod";

const DbEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	DATABASE_URL: z.string().url().optional(),
	CLICKHOUSE_URL: z.string().url().optional(),
	CLICKHOUSE_USER: z.string().optional(),
	CLICKHOUSE_PASSWORD: z.string().optional(),
	CLICKHOUSE_DB: z.string().optional(),
});

export const env = DbEnvSchema.parse(process.env);
