import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import type { AskPromptResult, Source } from "@onescope/types";
import { getNextProxy, recordProxyResult } from "../../../../lib/browser/proxy/pool.js";
import { logger } from "../../../../lib/utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve script path relative to this file: ../../../../scripts/google_search.py
const SCRIPT_PATH = join(__dirname, "..", "..", "..", "..", "..", "scripts", "google_search.py");

interface PythonResult {
	response: string;
	sources: Source[];
	error?: string;
	rate_limited?: boolean;
}

/** Thrown when Google returns 429. The proxy is healthy — caller should backoff, not rotate. */
export class RateLimitedError extends Error {
	constructor() {
		super("[google-ai-overview] Rate limited by Google (429)");
		this.name = "RateLimitedError";
	}
}

/**
 * Calls the Python curl_cffi script to search Google and extract the AI Overview.
 * Selects a proxy from the pool, records the result for scoring, and returns
 * an AskPromptResult suitable for storage.
 */
export async function searchGoogleAIOverview(
	userId: string,
	workspaceId: string,
	promptId: string,
	prompt: string,
): Promise<AskPromptResult> {
	const proxy = getNextProxy();

	if (!proxy) {
		throw new Error("[google-ai-overview] No proxies available in pool");
	}

	logger.log(`[google-ai-overview] Searching: "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`);

	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";

		const child = spawn("python3", [SCRIPT_PATH, prompt, proxy], {
			timeout: 45_000, // 45 s hard cap per query
		});

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("close", (code) => {
			if (stderr.trim()) {
				logger.warn(`[google-ai-overview] python stderr: ${stderr.trim()}`);
			}

			if (code !== 0) {
				recordProxyResult(proxy, false, "connection_error", "google-ai-overview");
				return reject(
					new Error(`[google-ai-overview] Python script exited with code ${code}: ${stderr.trim()}`),
				);
			}

			let parsed: PythonResult;
			try {
				parsed = JSON.parse(stdout.trim());
			} catch {
				recordProxyResult(proxy, false, "connection_error", "google-ai-overview");
				return reject(
					new Error(`[google-ai-overview] Failed to parse Python output: ${stdout.slice(0, 200)}`),
				);
			}

			if (parsed.rate_limited) {
				// Proxy is healthy — Google rate-limited the query. Don't penalise the proxy.
				logger.warn(`[google-ai-overview] Rate limited (429) via proxy ${proxy}`);
				return reject(new RateLimitedError());
			}

			if (parsed.error) {
				// Script returned gracefully but hit a non-429 HTTP error
				recordProxyResult(proxy, false, "connection_error", "google-ai-overview");
				return reject(new Error(`[google-ai-overview] Script error: ${parsed.error}`));
			}

			recordProxyResult(proxy, true, undefined, "google-ai-overview");

			logger.success(
				`[google-ai-overview] Got response (${parsed.response.length} chars, ${parsed.sources.length} sources)`,
			);

			resolve({
				userId,
				workspaceId,
				promptId,
				prompt,
				response: parsed.response,
				sources: parsed.sources ?? [],
			});
		});

		child.on("error", (err) => {
			recordProxyResult(proxy, false, "connection_error", "google-ai-overview");
			reject(new Error(`[google-ai-overview] Failed to spawn Python: ${err.message}`));
		});
	});
}
