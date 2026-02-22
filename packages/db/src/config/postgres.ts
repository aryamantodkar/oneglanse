if (
	process.env.NODE_ENV === "production" &&
	process.env.NEXT_PHASE !== "phase-production-build" &&
	!process.env.DATABASE_URL
) {
	throw new Error("DATABASE_URL is not defined");
}

export const postgresConfig = {
	databaseUrl: process.env.DATABASE_URL,
};
