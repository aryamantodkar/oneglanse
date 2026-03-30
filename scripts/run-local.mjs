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
				AGENT_RUNTIME_ENV: "local",
			},
		},
	);

	attachTerminationHandler(child);

	try {
		await waitForHttp("http://127.0.0.1:3000");
		openBrowser("http://127.0.0.1:3000");
	} catch {}

	await waitForChildExit(child, "Local dev");
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
