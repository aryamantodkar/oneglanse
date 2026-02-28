import { env } from "../env.js";

if (
	env.NODE_ENV === "production" &&
	env.NEXT_PHASE !== "phase-production-build"
) {
	if (!env.CLICKHOUSE_USER) throw new Error("CLICKHOUSE_USER is not defined");
	if (!env.CLICKHOUSE_PASSWORD) throw new Error("CLICKHOUSE_PASSWORD is not defined");
	if (!env.CLICKHOUSE_DB) throw new Error("CLICKHOUSE_DB is not defined");
	// if (env.CLICKHOUSE_USER === "default") {
	// 	throw new Error("CLICKHOUSE_USER must not be 'default' in production");
	// }
}

export const clickhouseConfig = {
	url: env.CLICKHOUSE_URL ?? "http://clickhouse:8123",
	username: env.CLICKHOUSE_USER,
	password: env.CLICKHOUSE_PASSWORD,
	database: env.CLICKHOUSE_DB,
};
