import {
	attachTerminationHandler,
	buildLocalWorkspacePackages,
	buildLocalRuntimeEnv,
	edgeNetworkName,
	ensureLocalCamoufoxRuntime,
	ensureDockerNetwork,
	ensureEnvFiles,
	openBrowser,
	repoRoot,
	runCommand,
	spawnCommand,
	terminateLocalProcesses,
	waitForChildExit,
	waitForHttp,
} from "./lib/runtime.mjs";

const localAppUrl = "http://localhost:3000";

async function main() {
	await ensureEnvFiles();
	await ensureLocalCamoufoxRuntime();
	await buildLocalWorkspacePackages();
	const localEnv = buildLocalRuntimeEnv(localAppUrl);
	await ensureDockerNetwork(edgeNetworkName);
	await runCommand("docker", [
		"compose",
		"up",
		"-d",
		"--build",
		"--wait",
		"db",
		"clickhouse",
		"redis",
	]);
	await runCommand("pnpm", ["db:migrate"], { env: localEnv });
	await terminateLocalProcesses([
		repoRoot,
		"@oneglanse/agent",
		"dev",
	]);

	const webChild = spawnCommand(
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
			"3000",
		],
		{
			env: localEnv,
		},
	);
	const agentChild = spawnCommand("pnpm", ["--filter", "@oneglanse/agent", "dev"], {
		env: localEnv,
	});

	const stopWeb = attachTerminationHandler(webChild);
	const stopAgent = attachTerminationHandler(agentChild);

	try {
		await waitForHttp(localAppUrl);
		openBrowser(localAppUrl);
	} catch (error) {
		stopWeb();
		stopAgent();
		throw error;
	}

	await Promise.all([
		waitForChildExit(webChild, "Web dev"),
		waitForChildExit(agentChild, "Agent dev"),
	]);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
