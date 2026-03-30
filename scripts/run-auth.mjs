import {
	attachTerminationHandler,
	ensureEnvFiles,
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

	const port = readArg("--port", process.env.PORT ?? "3000");
	const localAppUrl = `http://127.0.0.1:${port}`;
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

	const authUrl = `${localAppUrl}/provider-connections`;

	const child = spawnCommand(
		"pnpm",
		[
			"--filter",
			"@oneglanse/web",
			"dev",
			"--",
			"--hostname",
			"127.0.0.1",
			"--port",
			String(port),
		],
		{
			env: {
				...process.env,
				ONEGLANSE_APP_MODE: "local",
				APP_URL: localAppUrl,
				API_BASE_URL: localAppUrl,
				BETTER_AUTH_URL: localAppUrl,
				NEXT_PUBLIC_API_URL: localAppUrl,
				...(uploadUrl ? { AGENT_AUTH_UPLOAD_URL: uploadUrl } : {}),
				...(uploadToken ? { AGENT_AUTH_UPLOAD_TOKEN: uploadToken } : {}),
			},
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
