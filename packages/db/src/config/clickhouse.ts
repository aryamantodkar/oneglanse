if (
	process.env.NODE_ENV === "production" &&
	process.env.NEXT_PHASE !== "phase-production-build"
) {
	if (!process.env.CLICKHOUSE_USER) throw new Error("CLICKHOUSE_USER is not defined");
	if (!process.env.CLICKHOUSE_PASSWORD) throw new Error("CLICKHOUSE_PASSWORD is not defined");
	if (!process.env.CLICKHOUSE_DB) throw new Error("CLICKHOUSE_DB is not defined");
}

export const clickhouseConfig = {
	url: process.env.CLICKHOUSE_URL ?? "http://clickhouse:8123",
	username: process.env.CLICKHOUSE_USER ?? "default",
	password: process.env.CLICKHOUSE_PASSWORD ?? "password",
	database: process.env.CLICKHOUSE_DB ?? "analytics",
};
