import {
	attachTerminationHandler,
	edgeNetworkName,
	ensureDockerNetwork,
	ensureEnvFiles,
	openBrowser,
	runCommand,
	spawnCommand,
	waitForChildExit,
	waitForHttp,
} from "./lib/runtime.mjs";

const localAppUrl = "http://127.0.0.1:3000";

async function main() {
	await ensureEnvFiles();
	await ensureDockerNetwork(edgeNetworkName);
	await runCommand("docker", ["compose", "up", "-d", "db", "clickhouse", "redis"]);
	await runCommand("pnpm", ["db:migrate"]);

	const child = spawnCommand(
		"pnpm",
		[
			"exec",
			"turbo",
			"dev",
			"--filter=@oneglanse/web",
			"--filter=@oneglanse/agent",
		],
		{
			env: {
				...process.env,
				ONEGLANSE_APP_MODE: "local",
				APP_URL: localAppUrl,
				API_BASE_URL: localAppUrl,
				BETTER_AUTH_URL: localAppUrl,
				NEXT_PUBLIC_API_URL: localAppUrl,
			},
		},
	);

	attachTerminationHandler(child);

	try {
		await waitForHttp(localAppUrl);
		openBrowser(localAppUrl);
	} catch {}

	await waitForChildExit(child, "Local dev");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
