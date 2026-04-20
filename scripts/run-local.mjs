import {
	LOCAL_WATCH_PACKAGES,
	attachTerminationHandler,
	buildLocalRuntimeEnv,
	buildLocalWorkspacePackages,
	edgeNetworkName,
	ensureDockerNetwork,
	ensureEnvFiles,
	ensureLocalCamoufoxRuntime,
	openBrowser,
	repoRoot,
	runCommand,
	spawnCommand,
	spawnLocalWorkspacePackageWatchers,
	terminateLocalProcesses,
	terminateLocalWorkspacePackageWatchers,
	waitForChildExit,
	waitForHttp,
} from "./lib/runtime.mjs";

const localAppUrl = "http://localhost:3000";

async function main() {
	await ensureEnvFiles();
	await runCommand("pnpm", ["install"]);
	await ensureLocalCamoufoxRuntime();
	await buildLocalWorkspacePackages();
	const localEnv = buildLocalRuntimeEnv(localAppUrl);
	await ensureDockerNetwork(edgeNetworkName);
	await runCommand("docker", [
		"compose",
		"up",
		"-d",
		"--build",
		"--pull",
		"always",
		"--force-recreate",
		"--wait",
		"db",
		"clickhouse",
		"redis",
	]);
	await runCommand("pnpm", ["db:migrate"], { env: localEnv });
	await terminateLocalProcesses([repoRoot, "@oneglanse/agent", "dev"]);
	await terminateLocalWorkspacePackageWatchers();

	const packageWatchers = spawnLocalWorkspacePackageWatchers(localEnv);

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
	const agentChild = spawnCommand(
		"pnpm",
		["--filter", "@oneglanse/agent", "dev"],
		{
			env: localEnv,
		},
	);

	const stopPackageWatchers = packageWatchers.map((child) =>
		attachTerminationHandler(child),
	);
	const stopWeb = attachTerminationHandler(webChild);
	const stopAgent = attachTerminationHandler(agentChild);

	try {
		await waitForHttp(localAppUrl);
		openBrowser(localAppUrl);
	} catch (error) {
		for (const stopWatcher of stopPackageWatchers) {
			stopWatcher();
		}
		stopWeb();
		stopAgent();
		throw error;
	}

	await Promise.all([
		...packageWatchers.map((child, index) =>
			waitForChildExit(
				child,
				`Workspace package watch ${LOCAL_WATCH_PACKAGES[index]}`,
			),
		),
		waitForChildExit(webChild, "Web dev"),
		waitForChildExit(agentChild, "Agent dev"),
	]);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
