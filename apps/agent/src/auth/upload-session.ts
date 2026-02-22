import fs from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { PROVIDER_LIST } from "@onescope/types";
import dotenv from "dotenv";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import { logger } from "../lib/utils/logger.js";

if (fs.existsSync("apps/agent/.env")) {
	dotenv.config({ path: "apps/agent/.env" });
} else if (fs.existsSync(".env")) {
	dotenv.config();
}

interface SessionData {
	anthropic?: any;
	openai?: any;
	perplexity?: any;
	google?: any;
}

async function uploadSessions() {
	const VPS_API_URL = process.env.VPS_API_URL;
	const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
	const AUTH_PROFILE_PATH = process.env.LOCAL_AUTH_PROFILE_PATH || "./storage";

	logger.log("📤 Starting session upload via HTTP...");

	if (!API_AUTH_TOKEN) {
		logger.error("API_AUTH_TOKEN not set in environment");
		logger.error("Please set API_AUTH_TOKEN in your .env file");
		process.exit(1);
	}

	if (!VPS_API_URL) {
		logger.error("VPS_API_URL not set in environment");
		logger.error("Please set VPS_API_URL in your .env file");
		process.exit(1);
	}

	// Check VPS health first
	logger.log(`🔍 Checking VPS health at ${VPS_API_URL}/health...`);
	try {
		const healthResponse = await fetch(`${VPS_API_URL}/health`);
		if (!healthResponse.ok) {
			throw new Error(`VPS health check failed: ${healthResponse.status}`);
		}
		const health = await healthResponse.json();
		logger.log("✅ VPS is healthy:", health);
	} catch (err: any) {
		logger.error("Failed to connect to VPS:", err.message);
		logger.error("Make sure the VPS is running and accessible");
		logger.error(`Tried to connect to: ${VPS_API_URL}/health`);
		process.exit(1);
	}

	// Read session files
	const sessions: SessionData = {};
	// google-ai-overview shares the google (Gemini) session — no separate file to upload
	const providers = PROVIDER_LIST.filter((p) => p !== "google-ai-overview");

	for (const provider of providers) {
		const authFile = path.join(
			AUTH_PROFILE_PATH,
			provider,
			`${provider}-auth.json`,
		);

		if (!fs.existsSync(authFile)) {
			logger.warn(
				`Session file not found for ${AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider}: ${authFile}`,
			);
			continue;
		}

		try {
			const sessionData = JSON.parse(fs.readFileSync(authFile, "utf-8"));
			sessions[provider as keyof SessionData] = sessionData;
			logger.log(
				`✅ Read session for ${AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider} (${authFile})`,
			);
		} catch (err: any) {
			logger.error(
				`Failed to read session for ${AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider}:`,
				err.message,
			);
		}
	}

	if (Object.keys(sessions).length === 0) {
		logger.error("No session files found to upload");
		logger.error("Run 'pnpm run login' first to create sessions");
		process.exit(1);
	}

	// Upload sessions one by one to avoid nginx size limits
	logger.log(
		`📤 Uploading ${Object.keys(sessions).length} sessions to VPS (one by one)...\n`,
	);

	const uploadResults: Record<string, boolean> = {};
	let successCount = 0;
	let failCount = 0;

	for (const [provider, sessionData] of Object.entries(sessions)) {
		try {
			const modelName =
				AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider;
			logger.log(`📤 Uploading ${modelName} session...`);

			const response = await fetch(`${VPS_API_URL}/upload-sessions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${API_AUTH_TOKEN}`,
				},
				body: JSON.stringify({ [provider]: sessionData }),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Upload failed (${response.status}): ${errorText}`);
			}

			const result = await response.json();
			uploadResults[provider] = true;
			successCount++;
			logger.success(`✅ ${modelName} session uploaded successfully`);
		} catch (err: any) {
			const modelName =
				AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider;
			uploadResults[provider] = false;
			failCount++;
			logger.error(`❌ Failed to upload ${modelName} session:`, err.message);
		}
	}

	logger.log(
		`\n📊 Upload Summary: ${successCount} succeeded, ${failCount} failed\n`,
	);

	if (successCount === 0) {
		logger.error("All uploads failed!");
		process.exit(1);
	}

	if (failCount > 0) {
		logger.warn("Some uploads failed. Check errors above.");
	} else {
		logger.success("All sessions uploaded successfully!");
	}

	// Verify sessions on VPS
	try {
		logger.log("🔍 Verifying sessions on VPS...");
		const healthCheck = await fetch(`${VPS_API_URL}/health`);
		const health = await healthCheck.json();

		logger.log("\n📊 Session status on VPS:");
		logger.log(
			`   ${AGENT_PROVIDER_CONFIG.anthropic.displayName}: ${health.sessions.anthropic ? "✅" : "❌"}`,
		);
		logger.log(
			`   ${AGENT_PROVIDER_CONFIG.openai.displayName}: ${health.sessions.openai ? "✅" : "❌"}`,
		);
		logger.log(
			`   ${AGENT_PROVIDER_CONFIG.perplexity.displayName}: ${health.sessions.perplexity ? "✅" : "❌"}`,
		);
		logger.log(
			`   ${AGENT_PROVIDER_CONFIG.google.displayName}: ${health.sessions.google ? "✅" : "❌"} (also used for AI Overview)`,
		);

		logger.success("\nSession verification complete!");
		logger.log("👉 You can now run jobs on the VPS");
	} catch (err: any) {
		logger.warn("Could not verify sessions:", err.message);
	}
}

uploadSessions();
