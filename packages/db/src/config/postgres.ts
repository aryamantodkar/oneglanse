import { env } from "../env.js";

const postgresConfig = {
	databaseUrl: env.DATABASE_URL,
};

function isNextBuildPhase(): boolean {
	const lifecycleEvent = process.env.npm_lifecycle_event;
	const argv = process.argv.join(" ");

	return (
		process.env.NEXT_PHASE === "phase-production-build" ||
		lifecycleEvent === "build" ||
		argv.includes("next build")
	);
}

export function getRequiredDatabaseUrl(): string {
	// Next.js build can import route modules while collecting page data.
	// Allow a non-functional placeholder URL during build-only phase.
	if (!env.DATABASE_URL && isNextBuildPhase()) {
		return "postgresql://placeholder:placeholder@localhost:5432/placeholder";
	}

	if (!env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not defined. Set DATABASE_URL before starting the application.",
		);
	}

	return env.DATABASE_URL;
}
