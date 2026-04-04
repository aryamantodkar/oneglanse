import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		APP_URL: z.string().url().optional(),
		API_BASE_URL: z.string().url().optional(),
		ONEGLANSE_APP_MODE: z.enum(["cloud", "self-hosted", "local"]).optional(),
		INTERNAL_CRON_SECRET: z.string().min(1).optional(),
		BETTER_AUTH_SECRET: z.string().min(1).optional(),
		GOOGLE_CLIENT_ID: z.string().min(1).optional(),
		GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	client: {},
	runtimeEnv: {
		APP_URL: process.env.APP_URL,
		API_BASE_URL: process.env.API_BASE_URL,
		ONEGLANSE_APP_MODE: process.env.ONEGLANSE_APP_MODE,
		INTERNAL_CRON_SECRET: process.env.INTERNAL_CRON_SECRET,
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
		NODE_ENV: process.env.NODE_ENV,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
