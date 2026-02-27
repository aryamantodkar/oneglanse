import { env } from "../env.js";

const postgresConfig = {
	databaseUrl: env.DATABASE_URL,
};

export function getRequiredDatabaseUrl(): string {
	if (!env.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not defined. Set DATABASE_URL before starting the application.",
		);
	}

	return env.DATABASE_URL;
}
