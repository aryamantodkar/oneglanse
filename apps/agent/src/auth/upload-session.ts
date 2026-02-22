import fs from "node:fs";
import path from "node:path";
import { PROVIDER_LIST } from "@onescope/types";
import dotenv from "dotenv";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import { logger } from "../lib/utils/logger.js";

if (fs.existsSync("apps/agent/.env")) {
	dotenv.config({ path: "apps/agent/.env", quiet: true });
} else if (fs.existsSync(".env")) {
	dotenv.config({ quiet: true });
}

interface SessionData {
	anthropic?: any;
	openai?: any;
	perplexity?: any;
	google?: any;
}

type StorageCookie = {
	domain?: string;
};

type StorageOrigin = {
	origin?: string;
};

type StorageState = {
	cookies?: StorageCookie[];
	origins?: StorageOrigin[];
};

const PROVIDER_DOMAIN_SUFFIXES: Record<keyof SessionData, string[]> = {
	openai: ["chatgpt.com", "openai.com"],
	anthropic: ["claude.ai", "anthropic.com"],
	perplexity: ["perplexity.ai"],
	google: ["google.com", "googleusercontent.com", "gstatic.com"],
};

function matchesSuffix(hostOrDomain: string, suffixes: string[]): boolean {
	const normalized = hostOrDomain.replace(/^\./, "").toLowerCase();
	return suffixes.some(
		(suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
	);
}

function compactStorageStateForProvider(
	provider: keyof SessionData,
	state: StorageState,
): StorageState {
	const suffixes = PROVIDER_DOMAIN_SUFFIXES[provider];

	const cookies = (state.cookies ?? []).filter((cookie) => {
		const domain = cookie.domain;
		if (!domain) return false;
		return matchesSuffix(domain, suffixes);
	});

	const origins = (state.origins ?? []).filter((originEntry) => {
		try {
			const origin = originEntry.origin;
			if (!origin) return false;
			const host = new URL(origin).hostname;
			return matchesSuffix(host, suffixes);
		} catch {
			return false;
		}
	});

	return { cookies, origins };
}

async function uploadSessions() {
	const VPS_API_URL = process.env.VPS_API_URL;
	const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
	const AUTH_PROFILE_PATH = process.env.LOCAL_AUTH_PROFILE_PATH || "./storage";

	logger.log("Upload sessions");

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
	logger.log("Health check");
	try {
		const healthResponse = await fetch(`${VPS_API_URL}/health`);
		if (!healthResponse.ok) {
			throw new Error(`VPS health check failed: ${healthResponse.status}`);
		}
		logger.success("Health check passed");
	} catch (err: any) {
		logger.error(`VPS health check failed: ${err.message}`);
		logger.error(`Health endpoint: ${VPS_API_URL}/health`);
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
			continue;
		}

		try {
			const rawSession = JSON.parse(fs.readFileSync(authFile, "utf-8"));
			const typedProvider = provider as keyof SessionData;
			const compactSession = compactStorageStateForProvider(
				typedProvider,
				rawSession,
			);
			const rawSize = Buffer.byteLength(JSON.stringify(rawSession), "utf-8");
			const compactSize = Buffer.byteLength(
				JSON.stringify(compactSession),
				"utf-8",
			);
			sessions[typedProvider] = compactSession;
			logger.debug(
				`${AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider}: ${Math.round(rawSize / 1024)}KB -> ${Math.round(compactSize / 1024)}KB`,
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
	logger.log(`Uploading ${Object.keys(sessions).length} session(s)`);

	const uploadResults: Record<string, boolean> = {};
	let successCount = 0;
	let failCount = 0;

	for (const [provider, sessionData] of Object.entries(sessions)) {
		try {
			const modelName =
				AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider;
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
				if (response.status === 413) {
					throw new Error(
						"Upload failed (413): payload too large for server. Increase nginx client_max_body_size or reduce stored browser profile data.",
					);
				}
				throw new Error(`Upload failed (${response.status}): ${errorText}`);
			}

			await response.json();
			uploadResults[provider] = true;
			successCount++;
			logger.debug(`${modelName}: uploaded`);
		} catch (err: any) {
			const modelName =
				AGENT_PROVIDER_CONFIG[provider as keyof typeof AGENT_PROVIDER_CONFIG]?.displayName || provider;
			uploadResults[provider] = false;
			failCount++;
			logger.error(`${modelName}: upload failed - ${err.message}`);
		}
	}

	logger.log(`Upload summary: success=${successCount}, failed=${failCount}`);

	if (successCount === 0) {
		logger.error("All uploads failed!");
		process.exit(1);
	}

	if (failCount > 0) {
		logger.warn("Some uploads failed.");
	} else {
		logger.success("All sessions uploaded.");
	}

	// Verify sessions on VPS
	try {
		logger.log("Verification");
		const healthCheck = await fetch(`${VPS_API_URL}/health`);
		const health = await healthCheck.json();

		const okCount = ["anthropic", "openai", "perplexity", "google"].filter(
			(key) => Boolean(health.sessions?.[key]),
		).length;
		logger.success(`Verification: ${okCount}/4 sessions present on VPS`);
	} catch (err: any) {
		logger.warn(`Verification failed: ${err.message}`);
	}
}

uploadSessions();
