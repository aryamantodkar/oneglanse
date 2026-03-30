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

function parseArgs(argv) {
	const args = [...argv];
	const stackIndex = args.indexOf("--stack");
	const stack =
		stackIndex === -1 ? "app" : args[stackIndex + 1] ?? "app";

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

async function main() {
	await ensureEnvFiles();
	const { stack, composeArgs } = parseArgs(process.argv.slice(2));
	if (COMMANDS_REQUIRING_EDGE_NETWORK.has(composeArgs[0] ?? "")) {
		await ensureDockerNetwork(edgeNetworkName);
	}
	const files = STACK_FILES[stack];

	for (const file of files) {
		await runComposeForFile(file, composeArgs);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
