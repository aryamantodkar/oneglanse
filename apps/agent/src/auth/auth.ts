import { execSync } from "node:child_process";
import { logger } from "../lib/utils/logger.js";

function runStep(name: string, cmd: string): boolean {
	logger.log(`\n${name}`);
	try {
		execSync(cmd, { stdio: "inherit" });
		return true;
	} catch {
		logger.error(`${name} failed`);
		return false;
	}
}

async function main() {
	logger.log("Auth flow");

	const loginOk = runStep("Step 1/2: Login providers", "pnpm -s run login");
	if (!loginOk) {
		process.exit(1);
	}

	const uploadOk = runStep("Step 2/2: Upload sessions", "pnpm -s run upload-session");
	if (!uploadOk) {
		logger.error("Upload failed. Check VPS /health and API logs.");
		process.exit(1);
	}

	logger.success("Auth flow complete. Sessions uploaded.");
}

main();
