import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..", "..");
export const edgeNetworkName = "oneglanse-edge";

const rootEnvFile = path.join(repoRoot, ".env");
const rootEnvExampleFile = path.join(repoRoot, ".env.example");
const agentEnvFile = path.join(repoRoot, "apps", "agent", ".env");
const agentEnvExampleFile = path.join(repoRoot, "apps", "agent", ".env.example");

async function ensureFile(targetFile, sourceFile) {
	if (existsSync(targetFile)) {
		return;
	}

	await mkdir(path.dirname(targetFile), { recursive: true });
	await copyFile(sourceFile, targetFile);
	console.log(`Created ${path.relative(repoRoot, targetFile)} from ${path.relative(repoRoot, sourceFile)}.`);
}

function stripWrappingQuotes(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return;
	}

	const raw = readFileSync(filePath, "utf8");
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		if (!key || process.env[key] !== undefined) {
			continue;
		}

		const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim());
		process.env[key] = value;
	}
}

export async function ensureEnvFiles() {
	await ensureFile(rootEnvFile, rootEnvExampleFile);
	await ensureFile(agentEnvFile, agentEnvExampleFile);
	loadEnvFile(rootEnvFile);
	loadEnvFile(agentEnvFile);
}

export function spawnCommand(command, args, options = {}) {
	return spawn(command, args, {
		cwd: repoRoot,
		stdio: "inherit",
		env: process.env,
		...options,
	});
}

function encodeSegment(value) {
	return encodeURIComponent(value);
}

export function buildLocalRuntimeEnv(localAppUrl) {
	const postgresUser = process.env.POSTGRES_USER || "postgres";
	const postgresPassword = process.env.POSTGRES_PASSWORD || "postgres";
	const postgresDatabase = process.env.POSTGRES_DB || "oneglanse";
	const redisPort = process.env.REDIS_PORT || "6379";

	return {
		...process.env,
		ONEGLANSE_APP_MODE: "local",
		APP_URL: localAppUrl,
		API_BASE_URL: localAppUrl,
		BETTER_AUTH_URL: localAppUrl,
		NEXT_PUBLIC_API_URL: localAppUrl,
		DATABASE_URL: `postgresql://${encodeSegment(postgresUser)}:${encodeSegment(postgresPassword)}@127.0.0.1:5432/${encodeSegment(postgresDatabase)}`,
		CLICKHOUSE_URL: "http://127.0.0.1:8123",
		REDIS_HOST: "127.0.0.1",
		REDIS_PORT: redisPort,
	};
}

export function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawnCommand(command, args, options);
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(
				new Error(
					`${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}.`,
				),
			);
		});
	});
}

export async function ensureDockerNetwork(name) {
	try {
		await runCommand("docker", ["network", "inspect", name], {
			stdio: "ignore",
		});
	} catch {
		await runCommand("docker", ["network", "create", name]);
	}
}

export async function waitForHttp(url, timeoutMs = 60_000) {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const response = await fetch(url, { cache: "no-store" });
			if (response.ok) {
				return;
			}
		} catch {}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`Timed out waiting for ${url}.`);
}

export function openBrowser(url) {
	const platform = process.platform;
	const command =
		platform === "darwin"
			? "open"
			: platform === "win32"
				? "cmd"
				: "xdg-open";
	const args =
		platform === "win32" ? ["/c", "start", "", url] : [url];
	const child = spawn(command, args, {
		cwd: repoRoot,
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}

export function attachTerminationHandler(child) {
	const shutdown = () => {
		if (!child.killed) {
			child.kill("SIGTERM");
		}
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	return shutdown;
}

export function waitForChildExit(child, label) {
	return new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code === 0 || signal === "SIGTERM" || signal === "SIGINT") {
				resolve();
				return;
			}

			reject(
				new Error(
					`${label} exited with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}.`,
				),
			);
		});
	});
}
