import type { Provider } from "@onescope/types";
import { PROVIDERS } from "@onescope/utils";
import { logger } from "../lib/utils/logger.js";
import { checkAuthStatus } from "./checkStatus.js";
import { loginToAll } from "./loginToAll.js";
import { loginToProvider } from "./loginToProvider.js";

export { checkAuthStatus, loginToAll, loginToProvider };

async function runHeadedLogin(): Promise<void> {
	checkAuthStatus();

	// Check if single provider mode
	const targetProvider = process.env.PROVIDER as Provider | undefined;

	if (targetProvider) {
		if (!PROVIDERS[targetProvider]) {
			logger.error(`❌ Unknown provider: ${targetProvider}`);
			logger.log(`   Valid providers: ${Object.keys(PROVIDERS).join(", ")}`);
			process.exit(1);
		}

		logger.log(
			`\n🎯 Single Provider Mode: ${PROVIDERS[targetProvider].name}\n`,
		);
		await loginToProvider(targetProvider);
	} else {
		await loginToAll();
	}
}

if (process.env.RUN_INTERACTIVE_LOGIN === "true") {
	runHeadedLogin().catch((err) => {
		logger.error("Login flow failed", err);
		process.exit(1);
	});
}
