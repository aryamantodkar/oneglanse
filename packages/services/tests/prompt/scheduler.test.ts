import { execFileSync } from "node:child_process";
import { type IncomingMessage, createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const image = "oneglanse-scheduler-test:local";
const container = `oneglanse-scheduler-test-${process.pid}-${Date.now()}`;
const database = "oneglanse_scheduler_test";
const password = "scheduler-test-password";

function docker(...args: string[]): string {
	return execFileSync("docker", args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	}).trim();
}

async function waitForDatabase(pool: {
	query: (sql: string) => Promise<unknown>;
}): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			await pool.query("SELECT 1");
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	throw new Error("Test PostgreSQL did not become ready");
}

type CapturedRequest = {
	method: string | undefined;
	path: string;
	authorization: string | undefined;
	contentType: string | undefined;
	body: unknown;
};
const requests: CapturedRequest[] = [];
const server = createServer(async (request: IncomingMessage, response) => {
	let body = "";
	for await (const chunk of request) body += chunk.toString();
	requests.push({
		method: request.method,
		path: request.url ?? "",
		authorization: request.headers.authorization,
		contentType: request.headers["content-type"],
		body: JSON.parse(body),
	});
	response.writeHead(200, { "Content-Type": "application/json" });
	response.end("{}");
});

type Database = typeof import("@oneglanse/db");
type Scheduler = typeof import("../../src/prompt/scheduler.js");
let db: Database;
let scheduler: Scheduler;
let startedContainer = false;

beforeAll(async () => {
	await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Missing test HTTP port");
	process.env.API_BASE_URL = `http://host.docker.internal:${address.port}`;
	process.env.INTERNAL_CRON_SECRET = "test-secret";

	docker(
		"build",
		"-q",
		"-t",
		image,
		"-f",
		"packages/db/Dockerfile",
		repositoryRoot,
	);
	docker(
		"run",
		"-d",
		"--rm",
		"--name",
		container,
		"--add-host",
		"host.docker.internal:host-gateway",
		"-e",
		`POSTGRES_PASSWORD=${password}`,
		"-e",
		`POSTGRES_DB=${database}`,
		"-p",
		"127.0.0.1::5432",
		image,
		"postgres",
		"-c",
		"shared_preload_libraries=pg_cron",
		"-c",
		`cron.database_name=${database}`,
	);
	startedContainer = true;
	const mappedPort = docker("port", container, "5432/tcp").split(":").at(-1);
	if (!mappedPort) throw new Error("Missing test PostgreSQL port");
	process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${mappedPort}/${database}`;
	db = await import("@oneglanse/db");
	await waitForDatabase(db.pool);
	await db.pool.query('CREATE EXTENSION "pg_cron"');
	await db.pool.query('CREATE EXTENSION "http"');
	scheduler = await import("../../src/prompt/scheduler.js");
}, 120_000);

afterAll(async () => {
	if (db) await db.pool.end();
	await new Promise<void>((resolve) => server.close(() => resolve()));
	if (startedContainer) docker("rm", "-f", container);
});

describe("prompt scheduler against the bundled PostgreSQL extensions", () => {
	it("persists both settings for new PostgreSQL role sessions", async () => {
		await scheduler.configureSchedulerSecrets();
		const result = await db.pool.query<{ rolconfig: string[] | null }>(
			"SELECT rolconfig FROM pg_roles WHERE rolname = current_user",
		);
		expect(result.rows[0]?.rolconfig).toEqual(
			expect.arrayContaining([
				`app.api_base_url=${process.env.API_BASE_URL}`,
				"app.cron_secret=test-secret",
			]),
		);
	});

	it("runs the saved SQL through pg_cron and sends the authorized JSON request", async () => {
		await scheduler.configureSchedulerSecrets();
		await scheduler.scheduleCronForPrompts({
			workspaceId: "workspace-1",
			userId: "user's-id",
			cronExpression: "1 second",
		});
		try {
			const jobs = await db.pool.query<{ command: string }>(
				"SELECT command FROM cron.job WHERE jobname = $1",
				["auto_run_prompts_workspace-1"],
			);
			expect(jobs.rows[0]?.command).toBeDefined();
			expect(jobs.rows[0]?.command).not.toContain("test-secret");
			const deadline = Date.now() + 20_000;
			while (requests.length === 0 && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
			expect(requests[0]).toEqual({
				method: "POST",
				path: "/api/trpc/internal.runPrompts?batch=1",
				authorization: "Bearer test-secret",
				contentType: "application/json",
				body: {
					"0": { json: { workspaceId: "workspace-1", userId: "user's-id" } },
				},
			});
		} finally {
			await scheduler.unscheduleCronForPrompts({ workspaceId: "workspace-1" });
		}
	}, 30_000);
});
