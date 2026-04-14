import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import {
	attachTerminationHandler,
	ensureEnvFiles,
	ensureLocalCamoufoxRuntime,
	repoRoot,
	runCommand,
	spawnCommand,
	waitForChildExit,
} from "./lib/runtime.mjs";

// Only the packages the agent auth CLI actually depends on — no web/UI packages needed.
const AUTH_BUILD_PACKAGES = [
	"@oneglanse/types",
	"@oneglanse/errors",
	"@oneglanse/db",
	"@oneglanse/utils",
	"@oneglanse/services",
	"@oneglanse/agent",
];

async function buildAuthPackages() {
	for (const pkg of AUTH_BUILD_PACKAGES) {
		await runCommand("pnpm", ["--filter", pkg, "build"]);
	}
}

const PROVIDERS = ["chatgpt", "perplexity", "gemini", "google", "claude"];

function getAuthRootDir() {
	const configured = process.env.AGENT_AUTH_ROOT_DIR?.trim();
	return configured
		? path.resolve(configured)
		: path.join(repoRoot, ".oneglanse-storage", "auth");
}

function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return "0 B";

	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	const rounded =
		value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
	return `${rounded} ${units[unitIndex]}`;
}

async function uploadExistingSessionsIfPresent(uploadUrl, uploadToken) {
	const uploaded = [];
	const authRootDir = getAuthRootDir();
	const sessionFiles = PROVIDERS.map((provider) => ({
		provider,
		sessionFile: path.join(
			authRootDir,
			"sessions",
			provider,
			`${provider}-auth.json`,
		),
	})).filter(({ sessionFile }) => existsSync(sessionFile));

	if (sessionFiles.length === 0) {
		return uploaded;
	}

	console.log(
		`Uploading ${sessionFiles.length} auth session file${sessionFiles.length === 1 ? "" : "s"} to ${uploadUrl}`,
	);

	for (const [index, { provider, sessionFile }] of sessionFiles.entries()) {
		const rawSession = await readFile(sessionFile);
		const prefix = Buffer.from(
			`{"provider":${JSON.stringify(provider)},"session":`,
		);
		const suffix = Buffer.from("}");
		const payload = Buffer.concat([prefix, rawSession, suffix]);
		const body = zlib.gzipSync(payload);

		console.log(
			`[${index + 1}/${sessionFiles.length}] Uploading ${provider}: ${sessionFile} (${formatBytes(rawSession.length)} -> ${formatBytes(body.length)} gzip, overwrites existing remote session)`,
		);

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
				throw new Error(
					`Upload failed for ${provider} (${response.status}): ${await response.text()}`,
				);
			}
			console.log(`[${index + 1}/${sessionFiles.length}] Uploaded ${provider}`);
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

	console.log(
		`Upload complete. ${uploaded.length} session file${uploaded.length === 1 ? "" : "s"} overwritten on the VPS.`,
	);
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
	const explicitUrl = readArg(
		"--upload-url",
		process.env.AGENT_AUTH_UPLOAD_URL,
	);
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

function resolveTargetProviders() {
	const providerArg = readArg("--provider", null);
	if (providerArg) {
		if (!PROVIDERS.includes(providerArg)) {
			throw new Error(
				`Unknown provider: "${providerArg}". Must be one of: ${PROVIDERS.join(", ")}`,
			);
		}
		return [providerArg];
	}
	return PROVIDERS;
}

function launchProviderAuth(provider, uploadUrl, uploadToken) {
	const agentCliPath = path.join(
		repoRoot,
		"apps",
		"agent",
		"dist",
		"auth",
		"cli.js",
	);
	console.log(`Launching ${provider} auth browser...`);
	const child = spawnCommand("node", [agentCliPath, "--provider", provider], {
		env: {
			...process.env,
			ONEGLANSE_APP_MODE: "local",
			...(uploadUrl ? { AGENT_AUTH_UPLOAD_URL: uploadUrl } : {}),
			...(uploadToken ? { AGENT_AUTH_UPLOAD_TOKEN: uploadToken } : {}),
		},
	});
	attachTerminationHandler(child);
	return waitForChildExit(child, `${provider} auth`);
}

async function main() {
	await ensureEnvFiles();

	const uploadOnly = hasFlag("--upload-existing-only");
	const uploadUrl = resolveUploadUrl();
	const uploadToken = readArg(
		"--upload-token",
		process.env.AGENT_AUTH_UPLOAD_TOKEN,
	);

	if (Boolean(uploadUrl) !== Boolean(uploadToken)) {
		throw new Error(
			"--upload-url and --upload-token must be provided together.",
		);
	}

	// Upload-only: just read session files and POST — no Camoufox, no package builds
	if (uploadOnly) {
		if (!uploadUrl || !uploadToken) {
			throw new Error(
				"Upload config missing. Set AGENT_AUTH_UPLOAD_TOKEN and ONEGLANSE_VPS_IP (or AGENT_AUTH_UPLOAD_URL).",
			);
		}
		const uploadedProviders = await uploadExistingSessionsIfPresent(
			uploadUrl,
			uploadToken,
		);
		if (uploadedProviders.length > 0) {
			console.log(
				`Uploaded existing local auth sessions: ${uploadedProviders.join(", ")}`,
			);
		} else {
			throw new Error(
				"No existing local auth sessions were found to upload. Run `pnpm auth` first to capture them.",
			);
		}
		return;
	}

	await ensureLocalCamoufoxRuntime();
	await buildAuthPackages();

	const providers = resolveTargetProviders();
	console.log(`\nOpening auth browser${providers.length > 1 ? "s" : ""} for: ${providers.join(", ")}`);
	console.log("Log in and close each browser window when done.\n");

	await Promise.all(
		providers.map((provider) => launchProviderAuth(provider, uploadUrl, uploadToken)),
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
