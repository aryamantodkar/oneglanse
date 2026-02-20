import type { Config } from "drizzle-kit";

export default {
	schema: ["./src/schema/auth.ts", "./src/schema/workspace.ts"],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
} satisfies Config;
