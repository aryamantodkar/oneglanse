import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is required for migrations");
}

export default {
	schema: ["./src/schema/auth.ts", "./src/schema/workspace.ts"],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
} satisfies Config;
