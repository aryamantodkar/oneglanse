import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..", "..");
export const edgeNetworkName = "oneglanse-edge";

const rootEnvFile = path.join(repoRoot, ".env");
const rootEnvExampleFile = path.join(repoRoot, ".env.example");
const agentEnvFile = path.join(repoRoot, "apps", "agent", ".env");
const agentEnvExampleFile = path.join(
	repoRoot,
	"apps",
	"agent",
	".env.example",
);
const CAMOUFOX_PYTHON_CANDIDATES = [
	"python3.12",
	"python3.11",
	"python3.10",
	"python3",
];
// Keep local auth/runtime bootstrap reproducible instead of following the
// floating latest browser channel on every fresh machine.
const CAMOUFOX_DEFAULT_PIP_SPEC = "cloverlabs-camoufox==0.5.5";
const CAMOUFOX_DEFAULT_BROWSER_CHANNEL = "official/stable/135.0.1-beta.24";
const PYTHON_VERSION_PROBE = [
	"-c",
	[
		"import json",
		"import sys",
		"print(json.dumps({'major': sys.version_info.major, 'minor': sys.version_info.minor}))",
	].join("; "),
];
const CAMOUFOX_FETCH_SCRIPT = [
	"import camoufox.__main__ as camoufox_main",
	"camoufox_main.click.confirm = lambda *args, **kwargs: True",
	"camoufox_main.cli.main(args=['fetch'], prog_name='camoufox', standalone_mode=False)",
].join("; ");

let cachedLocalCamoufoxPython = null;

async function ensureFile(targetFile, sourceFile) {
	if (existsSync(targetFile)) {
		return;
	}

	await mkdir(path.dirname(targetFile), { recursive: true });
	await copyFile(sourceFile, targetFile);
	console.log(
		`Created ${path.relative(repoRoot, targetFile)} from ${path.relative(repoRoot, sourceFile)}.`,
	);
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

const LOCAL_BUILD_PACKAGES = [
	"@oneglanse/types",
	"@oneglanse/errors",
	"@oneglanse/db",
	"@oneglanse/utils",
	"@oneglanse/services",
	"@oneglanse/ui",
];

export function spawnCommand(command, args, options = {}) {
	return spawn(command, args, {
		cwd: repoRoot,
		stdio: "inherit",
		env: process.env,
		...options,
	});
}

export async function terminateLocalProcesses(commandFragments) {
	if (process.platform === "win32") {
		return;
	}

	const { stdout } = await runCommandCapture(
		"ps",
		["ax", "-o", "pid=", "-o", "command="],
		{ stdio: ["ignore", "pipe", "ignore"] },
	).catch(() => ({ stdout: "" }));

	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(/^(\d+)\s+(.*)$/);
		if (!match) continue;

		const pid = Number(match[1]);
		const command = match[2] || "";
		if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
		if (!commandFragments.every((fragment) => command.includes(fragment))) {
			continue;
		}

		try {
			process.kill(pid, "SIGTERM");
		} catch {}
	}
}

function killChildProcessTree(child, signal = "SIGTERM") {
	const pid = child.pid;
	if (!pid || child.killed) {
		return;
	}

	if (process.platform === "win32") {
		const forceFlag = signal === "SIGKILL" ? ["/f"] : [];
		void runCommandCapture(
			"taskkill",
			["/pid", String(pid), "/t", ...forceFlag],
			{
				stdio: ["ignore", "ignore", "ignore"],
			},
		).catch(() => {});
		return;
	}

	try {
		if (child.spawnargs && child.spawnargs.length > 0 && child.spawnfile) {
			process.kill(-pid, signal);
			return;
		}
	} catch {
		// Fall through to direct child kill.
	}

	try {
		child.kill(signal);
	} catch {
		// Process already exited.
	}
}

function encodeSegment(value) {
	return encodeURIComponent(value);
}

export function buildLocalRuntimeEnv(localAppUrl) {
	const postgresUser = process.env.POSTGRES_USER || "postgres";
	const postgresPassword = process.env.POSTGRES_PASSWORD || "postgres";
	const postgresDatabase = process.env.POSTGRES_DB || "oneglanse";
	const redisPort = process.env.REDIS_PORT || "6379";
	const localLocale =
		process.env.CAMOUFOX_LOCALE ||
		Intl.DateTimeFormat().resolvedOptions().locale ||
		"en-US";
	const localEnv = {
		...process.env,
		ONEGLANSE_APP_MODE: "local",
		APP_URL: localAppUrl,
		API_BASE_URL: localAppUrl,
		BETTER_AUTH_URL: localAppUrl,
		NEXT_PUBLIC_API_URL: localAppUrl,
		DATABASE_URL: `postgresql://${encodeSegment(postgresUser)}:${encodeSegment(postgresPassword)}@localhost:5432/${encodeSegment(postgresDatabase)}`,
		CLICKHOUSE_URL: "http://localhost:8123",
		REDIS_HOST: "localhost",
		REDIS_PORT: redisPort,
		CAMOUFOX_HEADLESS_MODE: "headless",
		CAMOUFOX_LOCALE: localLocale,
		// Firefox reads MOZ_HEADLESS during process bootstrap. Keep this scoped
		// to the local desktop runtime so cloud/Xvfb sessions are unaffected.
		MOZ_HEADLESS: "1",
	};

	localEnv.AGENT_AUTH_UPLOAD_URL = undefined;
	localEnv.AGENT_AUTH_UPLOAD_TOKEN = undefined;

	return localEnv;
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

export async function buildLocalWorkspacePackages() {
	for (const pkg of LOCAL_BUILD_PACKAGES) {
		await runCommand("pnpm", ["--filter", pkg, "build"]);
	}
}

export function runCommandCapture(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: repoRoot,
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
			...options,
		});
		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code === 0) {
				resolve({ stdout, stderr });
				return;
			}

			reject(
				new Error(
					stderr.trim() ||
						stdout.trim() ||
						`${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`}.`,
				),
			);
		});
	});
}

async function canRunCommand(command, args = ["--version"]) {
	try {
		await runCommandCapture(command, args, {
			stdio: ["ignore", "ignore", "ignore"],
		});
		return true;
	} catch {
		return false;
	}
}

async function getPythonVersion(command) {
	try {
		const { stdout } = await runCommandCapture(command, PYTHON_VERSION_PROBE);
		const parsed = JSON.parse(stdout);
		if (
			typeof parsed?.major === "number" &&
			typeof parsed?.minor === "number"
		) {
			return parsed;
		}
	} catch {}

	return null;
}

async function installCompatiblePython() {
	if (process.platform === "darwin" && (await canRunCommand("brew"))) {
		console.log("Installing Python 3.11 for local Camoufox support...");
		await runCommand("brew", ["install", "python@3.11"]);
		return "python3.11";
	}

	if (
		process.platform === "linux" &&
		typeof process.getuid === "function" &&
		process.getuid() === 0 &&
		(await canRunCommand("apt-get", ["--version"]))
	) {
		console.log("Installing Python 3 for local Camoufox support...");
		await runCommand("apt-get", ["update"]);
		await runCommand("apt-get", ["install", "-y", "python3", "python3-pip"]);
		return "python3";
	}

	if (
		process.platform === "win32" &&
		(await canRunCommand("winget", ["--info"]))
	) {
		console.log("Installing Python 3.11 for local Camoufox support...");
		await runCommand("winget", [
			"install",
			"-e",
			"--id",
			"Python.Python.3.11",
			"--silent",
		]);
		return "python";
	}

	throw new Error(
		"Unable to provision Python 3.10+ automatically on this machine. Install Python 3.10+ or set CAMOUFOX_PYTHON_BIN to a compatible interpreter.",
	);
}

async function resolveLocalCamoufoxPython() {
	if (cachedLocalCamoufoxPython) {
		return cachedLocalCamoufoxPython;
	}

	const configured = process.env.CAMOUFOX_PYTHON_BIN?.trim();
	const candidates = [
		...(configured ? [configured] : []),
		...CAMOUFOX_PYTHON_CANDIDATES,
	];

	for (const candidate of [...new Set(candidates)]) {
		const version = await getPythonVersion(candidate);
		if (
			version &&
			(version.major > 3 || (version.major === 3 && version.minor >= 10))
		) {
			cachedLocalCamoufoxPython = candidate;
			return candidate;
		}
	}

	const installedCandidate = await installCompatiblePython();
	const version = await getPythonVersion(installedCandidate);
	if (
		version &&
		(version.major > 3 || (version.major === 3 && version.minor >= 10))
	) {
		cachedLocalCamoufoxPython = installedCandidate;
		return installedCandidate;
	}

	throw new Error(
		"Python 3.10+ is still unavailable after attempting automatic installation.",
	);
}

async function ensureCamoufoxPackage(pythonBin) {
	try {
		await runCommandCapture(pythonBin, ["-c", "import camoufox, browserforge"]);
		return;
	} catch {}

	console.log("Installing Camoufox for local auth...");
	try {
		await runCommandCapture(pythonBin, ["-m", "ensurepip", "--upgrade"]);
	} catch {}

	const installArgs = ["-m", "pip", "install", "--upgrade"];
	if (process.platform !== "win32") {
		installArgs.push("--user");
	}
	if (process.platform === "linux") {
		installArgs.push("--break-system-packages");
	}
	installArgs.push(
		process.env.CAMOUFOX_PIP_SPEC?.trim() || CAMOUFOX_DEFAULT_PIP_SPEC,
	);
	await runCommand(pythonBin, installArgs);
}

async function ensureCamoufoxBrowser(pythonBin) {
	const desiredChannel =
		process.env.CAMOUFOX_BROWSER_CHANNEL?.trim() ||
		CAMOUFOX_DEFAULT_BROWSER_CHANNEL;

	let activeChannel = null;
	let browserInstalled = false;

	try {
		const [{ stdout: activeStdout }, { stdout: versionStdout }] =
			await Promise.all([
				runCommandCapture(pythonBin, ["-m", "camoufox", "active"]),
				runCommandCapture(pythonBin, ["-m", "camoufox", "version"]),
			]);
		activeChannel = activeStdout.trim() || null;
		browserInstalled = /\bInstalled\s+Yes\b/i.test(versionStdout);
	} catch {}

	if (activeChannel === desiredChannel && browserInstalled) {
		return;
	}

	console.log("Preparing Camoufox browser runtime for local auth...");
	await runCommand(pythonBin, ["-m", "camoufox", "set", desiredChannel]);
	await runCommand(pythonBin, ["-c", CAMOUFOX_FETCH_SCRIPT]);
}

export async function ensureLocalCamoufoxRuntime() {
	const pythonBin = await resolveLocalCamoufoxPython();
	await ensureCamoufoxPackage(pythonBin);
	await ensureCamoufoxBrowser(pythonBin);
	process.env.CAMOUFOX_PYTHON_BIN = pythonBin;
	return pythonBin;
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
		platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
	const args = platform === "win32" ? ["/c", "start", "", url] : [url];
	const child = spawn(command, args, {
		cwd: repoRoot,
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}

export function attachTerminationHandler(child) {
	let forceKillTimer = null;
	const shutdown = () => {
		killChildProcessTree(child, "SIGTERM");
		if (forceKillTimer) {
			return;
		}
		forceKillTimer = setTimeout(() => {
			killChildProcessTree(child, "SIGKILL");
		}, 5_000);
		forceKillTimer.unref?.();
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.on("SIGHUP", shutdown);
	child.once("exit", () => {
		if (forceKillTimer) {
			clearTimeout(forceKillTimer);
			forceKillTimer = null;
		}
	});

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
