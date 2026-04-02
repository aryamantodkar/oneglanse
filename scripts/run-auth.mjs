import {
	attachTerminationHandler,
	buildLocalWorkspacePackages,
	buildLocalRuntimeEnv,
	ensureEnvFiles,
	ensureLocalCamoufoxRuntime,
	openBrowser,
	spawnCommand,
	waitForChildExit,
	waitForHttp,
} from "./lib/runtime.mjs";

function readArg(flag, fallback) {
	const index = process.argv.indexOf(flag);
	if (index === -1) {
		return fallback;
	}

	return process.argv[index + 1] ?? fallback;
}

async function main() {
	await ensureEnvFiles();
	await ensureLocalCamoufoxRuntime();
	await buildLocalWorkspacePackages();

	const port = readArg("--port", process.env.PORT ?? "3000");
	const localAppUrl = `http://localhost:${port}`;
	const localEnv = buildLocalRuntimeEnv(localAppUrl);
	const uploadUrl = readArg("--upload-url", process.env.AGENT_AUTH_UPLOAD_URL);
	const uploadToken = readArg(
		"--upload-token",
		process.env.AGENT_AUTH_UPLOAD_TOKEN,
	);
	if (Boolean(uploadUrl) !== Boolean(uploadToken)) {
		throw new Error(
			"--upload-url and --upload-token must be provided together.",
		);
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
