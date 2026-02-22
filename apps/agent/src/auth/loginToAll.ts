import { PROVIDER_LIST, type Provider } from "@onescope/types";
import { logger } from "../lib/utils/logger.js";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import { loginToProvider } from "./loginToProvider.js";

function promptUser(question: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdout.write(question);

		// Enable raw mode to capture single keypress
		process.stdin.setRawMode(true);
		process.stdin.resume();

		const onKeypress = (chunk: Buffer) => {
			const key = chunk.toString().toLowerCase();

			// Only accept 'y' or 'n'
			if (key === "y" || key === "n") {
				process.stdout.write(`${key}\n`); // Echo the key and newline
				process.stdin.setRawMode(false);
				process.stdin.pause();
				process.stdin.removeListener("data", onKeypress);
				resolve(key);
			}
			// Ignore other keys (just don't respond)
		};

		process.stdin.on("data", onKeypress);
	});
}

export async function loginToAll(): Promise<void> {
	logger.log("\n🔐 AUTHENTICATION SETUP");
	logger.log(`${"=".repeat(70)}\n`);

	logger.log("📊 This will authenticate you with all AI models:");
	logger.log("   • ChatGPT");
	logger.log("   • Claude");
	logger.log("   • Perplexity");
	logger.log("   • Gemini (also used for AI Overview)\n");

	const results = Object.fromEntries(
		PROVIDER_LIST.map((p) => [p, "skipped" as const]),
	) as Record<Provider, "success" | "failed" | "skipped">;

	// google-ai-overview shares the google (Gemini) session — skip it in the login loop
	const loginProviders = (Object.keys(AGENT_PROVIDER_CONFIG) as Provider[]).filter(
		(p) => p !== "google-ai-overview",
	);

	for (const provider of loginProviders) {
		// Ask user if they want to authenticate this provider
		logger.log(`\n❓ Login to ${AGENT_PROVIDER_CONFIG[provider].displayName}?`);
		const answer = await promptUser("   (y/n): ");

		if (answer !== "y" && answer !== "yes") {
			logger.log(`⏭️  Skipped ${AGENT_PROVIDER_CONFIG[provider].displayName}\n`);
			results[provider] = "skipped";
			continue;
		}

		try {
			await loginToProvider(provider);
			results[provider] = "success";
		} catch (err: any) {
			results[provider] = "failed";

			logger.error(`❌ ${provider} authentication failed`);
			logger.error(`   Error: ${err.message}\n`);

			logger.warn("⚠️  Options:");
			logger.warn("   • Continue to next provider");
			logger.warn(
				`   • Retry this provider later with: pnpm run auth:${provider}`,
			);
			logger.warn(`   • Skip if you don't need ${provider}\n`);
		}
	}

	// Summary
	logger.log(`\n${"=".repeat(70)}`);
	logger.log("📊 AUTHENTICATION SUMMARY");
	logger.log(`${"=".repeat(70)}\n`);

	const successCount = Object.values(results).filter(
		(r) => r === "success",
	).length;
	const failedCount = Object.values(results).filter(
		(r) => r === "failed",
	).length;
	const skippedCount = Object.values(results).filter(
		(r) => r === "skipped",
	).length;

	for (const [provider, status] of Object.entries(results)) {
		const icon = status === "success" ? "✅" : status === "failed" ? "❌" : "⏭️";
		const label = `${provider}:`.padEnd(15);
		logger.log(`${icon} ${label} ${status.toUpperCase()}`);
	}

	logger.log();

	const attemptedCount = loginProviders.length - skippedCount;

	if (successCount === attemptedCount && attemptedCount > 0) {
		logger.success("🎉 All attempted providers authenticated successfully!");
		if (skippedCount > 0) {
			logger.log(`⏭️  ${skippedCount} provider(s) skipped`);
		}
	} else if (successCount > 0) {
		logger.warn(
			`⚠️  ${successCount}/${attemptedCount} attempted providers authenticated, ${failedCount} failed`,
		);
		if (skippedCount > 0) {
			logger.log(`⏭️  ${skippedCount} provider(s) skipped`);
		}
		logger.log("💡 You can retry failed providers individually");
	} else if (attemptedCount === 0) {
		logger.warn("⏭️  All providers skipped - no authentication performed");
	} else {
		logger.error("❌ All attempted authentications failed");
		logger.log("💡 Check your internet connection and try again");
	}

	logger.log();
}
