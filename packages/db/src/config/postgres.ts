import { env } from "../env.js";

if (
	env.NODE_ENV === "production" &&
	env.NEXT_PHASE !== "phase-production-build" &&
	!env.DATABASE_URL
) {
	throw new Error("DATABASE_URL is not defined");
}

export const postgresConfig = {
	databaseUrl: env.DATABASE_URL,
};
