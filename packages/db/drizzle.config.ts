import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
const isDrizzleCliRun = process.argv.some((arg) => arg.includes("drizzle-kit"));

if (isDrizzleCliRun && !databaseUrl) {
	throw new Error("DATABASE_URL environment variable is required for migrations");
}

export default {
	schema: ["./src/schema/auth.ts", "./src/schema/workspace.ts"],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		// Allow static analyzers (e.g. knip) to import config without requiring
		// DATABASE_URL. Real drizzle-kit executions still enforce DATABASE_URL above.
		url: databaseUrl ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
	},
} satisfies Config;
