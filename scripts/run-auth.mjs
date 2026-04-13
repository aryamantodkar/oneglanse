import net from "node:net";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import {
	attachTerminationHandler,
	buildLocalWorkspacePackages,
	buildLocalRuntimeEnv,
	ensureEnvFiles,
	ensureLocalCamoufoxRuntime,
	openBrowser,
	repoRoot,
	spawnCommand,
	waitForChildExit,
	waitForHttp,
} from "./lib/runtime.mjs";

const PROVIDERS = ["chatgpt", "perplexity", "gemini", "google", "claude"];

function getAuthRootDir() {
	const configured = process.env.AGENT_AUTH_ROOT_DIR?.trim();
	return configured ? path.resolve(configured) : path.join(repoRoot, ".oneglanse-storage", "auth");
}

async function uploadExistingSessionsIfPresent(uploadUrl, uploadToken) {
	const uploaded = [];
	for (const provider of PROVIDERS) {
		const sessionFile = path.join(getAuthRootDir(), "sessions", provider, `${provider}-auth.json`);
		if (!existsSync(sessionFile)) continue;

		// Build wrapper without parsing the JSON — avoids a full parse/stringify
		// cycle on large session files (e.g. ChatGPT can be 1+ MB)
		const rawSession = await readFile(sessionFile, "utf8");
		const wrapper = `{"provider":${JSON.stringify(provider)},"session":${rawSession}}`;
		const body = zlib.gzipSync(wrapper);

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 60_000);
		try {
			const response = await fetch(uploadUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Encoding": "gzip",
					"Content-Length": String(body.length),
					Authorization: `Bearer ${uploadToken}`,
				},
				body,
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new Error(`Upload failed for ${provider} (${response.status}): ${await response.text()}`);
			}
		} catch (err) {
			if (err.name === "AbortError") {
				throw new Error(`Upload timed out for ${provider} after 60s`);
			}
			throw err;
		} finally {
			clearTimeout(timer);
		}

		uploaded.push(provider);
	}
	return uploaded;
}

function readArg(flag, fallback) {
	const index = process.argv.indexOf(flag);
	if (index === -1) {
		return fallback;
	}

	return process.argv[index + 1] ?? fallback;
}

function hasFlag(flag) {
	return process.argv.includes(flag);
}

function normalizeBaseUrl(rawUrl) {
	if (!rawUrl) return null;
	const trimmed = String(rawUrl).trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed.replace(/\/+$/, "");
	}
	return `http://${trimmed.replace(/\/+$/, "")}`;
}

function resolveUploadUrl() {
	const explicitUrl = readArg("--upload-url", process.env.AGENT_AUTH_UPLOAD_URL);
	if (explicitUrl?.trim()) {
		return explicitUrl.trim();
	}

	const vpsIp = process.env.ONEGLANSE_VPS_IP?.trim();
	if (!vpsIp) {
		return undefined;
	}

	const baseUrl = normalizeBaseUrl(vpsIp);
	return `${baseUrl}:3333/auth/sessions`;
}

async function isPortAvailable(port) {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.unref();
		server.on("error", () => resolve(false));
		server.listen({ host: "127.0.0.1", port }, () => {
			server.close(() => resolve(true));
		});
	});
}

async function resolveAuthPort(requestedPort, explicitPortProvided) {
	const basePort = Number.parseInt(String(requestedPort), 10);
	if (!Number.isInteger(basePort) || basePort <= 0) {
		throw new Error(`Invalid auth port: ${requestedPort}`);
	}

	if (await isPortAvailable(basePort)) {
		return basePort;
	}

	if (explicitPortProvided) {
		throw new Error(
			`Auth server port ${basePort} is already in use. Pass a different --port value.`,
		);
	}

	for (let port = basePort + 1; port < basePort + 50; port += 1) {
		if (await isPortAvailable(port)) {
			console.log(`Port ${basePort} is busy. Using auth port ${port} instead.`);
			return port;
		}
	}

	throw new Error(
		`Could not find a free auth server port starting from ${basePort}.`,
	);
}

async function main() {
	await ensureEnvFiles();

	const uploadOnly = hasFlag("--upload-existing-only");
	const uploadUrl = resolveUploadUrl();
	const uploadToken = readArg("--upload-token", process.env.AGENT_AUTH_UPLOAD_TOKEN);

	if (Boolean(uploadUrl) !== Boolean(uploadToken)) {
		throw new Error("--upload-url and --upload-token must be provided together.");
	}

	// Upload-only: just read session files and POST — no Camoufox, no package builds
	if (uploadOnly) {
		if (!uploadUrl || !uploadToken) {
			throw new Error(
				"Upload config missing. Set AGENT_AUTH_UPLOAD_TOKEN and ONEGLANSE_VPS_IP (or AGENT_AUTH_UPLOAD_URL).",
			);
		}
		const uploadedProviders = await uploadExistingSessionsIfPresent(uploadUrl, uploadToken);
		if (uploadedProviders.length > 0) {
			console.log(`Uploaded existing local auth sessions: ${uploadedProviders.join(", ")}`);
		} else {
			throw new Error(
				"No existing local auth sessions were found to upload. Run `pnpm auth` first to capture them.",
			);
		}
		return;
	}

	await ensureLocalCamoufoxRuntime();
	await buildLocalWorkspacePackages();

	const explicitPortProvided = process.argv.includes("--port");
	const requestedPort = readArg("--port", process.env.PORT ?? "3000");
	const port = await resolveAuthPort(requestedPort, explicitPortProvided);
	const localAppUrl = `http://localhost:${port}`;
	const localEnv = buildLocalRuntimeEnv(localAppUrl);

	process.env.ONEGLANSE_APP_MODE = "local";
	if (uploadUrl) {
		process.env.AGENT_AUTH_UPLOAD_URL = uploadUrl;
	}
	if (uploadToken) {
		process.env.AGENT_AUTH_UPLOAD_TOKEN = uploadToken;
	}

	const authUrl = `${localAppUrl}/providers`;

	const child = spawnCommand(
		"pnpm",
		[
			"--filter",
			"@oneglanse/web",
			"exec",
			"next",
			"dev",
			"--hostname",
			"localhost",
			"--port",
			String(port),
		],
		{
			env: {
				...localEnv,
				...(uploadUrl ? { AGENT_AUTH_UPLOAD_URL: uploadUrl } : {}),
				...(uploadToken ? { AGENT_AUTH_UPLOAD_TOKEN: uploadToken } : {}),
			},
			detached: process.platform !== "win32",
		},
	);

	const shutdown = attachTerminationHandler(child);

	try {
		await waitForHttp(authUrl);
		openBrowser(authUrl);
	} catch (error) {
		shutdown();
		throw error;
	}

	await waitForChildExit(child, "Auth server");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
