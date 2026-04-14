import {
	edgeNetworkName,
	ensureDockerNetwork,
	ensureEnvFiles,
	runCommand,
} from "./lib/runtime.mjs";

const COMMANDS_REQUIRING_EDGE_NETWORK = new Set(["create", "start", "up"]);
const STACK_FILES = {
	app: ["docker-compose.yml"],
	public: ["docker-compose.public.yml"],
	all: ["docker-compose.yml", "docker-compose.public.yml"],
};
const DEFAULT_IMAGES = {
	ONEGLANSE_AGENT_IMAGE: "ghcr.io/aryamantodkar/oneglanse-agent:latest",
	ONEGLANSE_POSTGRES_IMAGE: "ghcr.io/aryamantodkar/oneglanse-postgres:latest",
	ONEGLANSE_WEB_IMAGE: "ghcr.io/aryamantodkar/oneglanse-web:latest",
	ONEGLANSE_LANDING_IMAGE: "ghcr.io/aryamantodkar/oneglanse-landing:latest",
};
const PULLABLE_SERVICES_BY_STACK = {
	app: [
		{ service: "redis" },
		{ service: "clickhouse" },
		{
			service: "agent-worker",
			envKey: "ONEGLANSE_AGENT_IMAGE",
			defaultImage: DEFAULT_IMAGES.ONEGLANSE_AGENT_IMAGE,
		},
		{
			service: "db",
			envKey: "ONEGLANSE_POSTGRES_IMAGE",
			defaultImage: DEFAULT_IMAGES.ONEGLANSE_POSTGRES_IMAGE,
		},
		{
			service: "web",
			envKey: "ONEGLANSE_WEB_IMAGE",
			defaultImage: DEFAULT_IMAGES.ONEGLANSE_WEB_IMAGE,
		},
		{
			service: "migrate",
			envKey: "ONEGLANSE_WEB_IMAGE",
			defaultImage: DEFAULT_IMAGES.ONEGLANSE_WEB_IMAGE,
		},
	],
	public: [
		{ service: "app-gateway" },
		{
			service: "landing",
			envKey: "ONEGLANSE_LANDING_IMAGE",
			defaultImage: DEFAULT_IMAGES.ONEGLANSE_LANDING_IMAGE,
		},
	],
};

function parseArgs(argv) {
	const args = [...argv];
	const stackIndex = args.indexOf("--stack");
	const stack = stackIndex === -1 ? "app" : (args[stackIndex + 1] ?? "app");

	if (!(stack in STACK_FILES)) {
		throw new Error(`Unknown stack "${stack}". Use app, public, or all.`);
	}

	if (stackIndex !== -1) {
		args.splice(stackIndex, 2);
	}

	return {
		stack,
		composeArgs: args.length > 0 ? args : ["up", "-d", "--build"],
	};
}

async function runComposeForFile(file, composeArgs) {
	await runCommand("docker", ["compose", "-f", file, ...composeArgs]);
}

function shouldPullConfiguredImage(envKey, defaultImage) {
	if (!envKey) {
		return true;
	}

	const configured = process.env[envKey]?.trim();
	if (!configured) {
		return defaultImage.includes("/");
	}

	return configured.includes("/");
}

async function runSmartPull(stack) {
	const stackKey = stack === "all" ? ["app", "public"] : [stack];

	for (const currentStack of stackKey) {
		const file = STACK_FILES[currentStack][0];
		const pullableServices = PULLABLE_SERVICES_BY_STACK[currentStack]
			.filter((entry) =>
				shouldPullConfiguredImage(entry.envKey, entry.defaultImage),
			)
			.map((entry) => entry.service);

		if (pullableServices.length === 0) {
			console.log(
				`Skipping docker pull for ${currentStack}: no remote images configured for that stack.`,
			);
			continue;
		}

		await runCommand("docker", [
			"compose",
			"-f",
			file,
			"pull",
			...pullableServices,
		]);
	}
}

async function runComposeForStack(stack, composeArgs) {
	const files = STACK_FILES[stack];
	for (const file of files) {
		await runComposeForFile(file, composeArgs);
	}
}

async function runBootstrap(stack) {
	await ensureDockerNetwork(edgeNetworkName);

	try {
		await runSmartPull(stack);
		await runComposeForStack(stack, ["up", "-d"]);
		console.log("Self-host stack started from pulled images.");
		return;
	} catch (pullError) {
		const message =
			pullError instanceof Error ? pullError.message : String(pullError);
		console.warn(
			`Image pull failed (${message}). Building from source instead...`,
		);
	}

	await runComposeForStack(stack, ["up", "-d", "--build"]);
	console.log("Self-host stack started from a local source build.");
}

async function main() {
	await ensureEnvFiles();
	const { stack, composeArgs } = parseArgs(process.argv.slice(2));
	if (composeArgs[0] === "bootstrap") {
		await runBootstrap(stack);
		return;
	}
	if (composeArgs[0] === "pull") {
		await runSmartPull(stack);
		return;
	}
	if (COMMANDS_REQUIRING_EDGE_NETWORK.has(composeArgs[0] ?? "")) {
		await ensureDockerNetwork(edgeNetworkName);
	}
	await runComposeForStack(stack, composeArgs);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
