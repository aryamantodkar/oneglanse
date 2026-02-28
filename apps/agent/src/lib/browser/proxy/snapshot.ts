import fs from "node:fs";
import { ExternalServiceError, toErrorMessage, ValidationError } from "@oneglanse/errors";
import { env } from "../../../env.js";
import { logger } from "@oneglanse/utils";
import { normalizeProxy } from "./scoring.js";

// ── Constants ────────────────────────────────────────────────────────────

const PROXY_CACHE_TTL_MS = env.PROXY_CACHE_TTL_MS;

// ── Cache state ───────────────────────────────────────────────────────────

let cachedProxySnapshot: string[] = [];
let cachedAt = 0;
let inFlightSnapshotFetch: Promise<string[]> | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function parseProxyFile(): string[] {
	const filePath = env.PROXY_MANUAL_FILE?.trim();
	if (!filePath) return [];

	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const list = content
			.split(/\r?\n/)
			.map((line) => normalizeProxy(line))
			.filter(Boolean);
		return list;
	} catch (err) {
		logger.warn(
			`Failed to read PROXY_MANUAL_FILE (${filePath}): ${toErrorMessage(err)}`,
		);
		return [];
	}
}

// ── Public API ────────────────────────────────────────────────────────────

export async function fetchProxySnapshot(
	forceRefresh = false,
): Promise<string[]> {
	const now = Date.now();
	const cacheFresh =
		!forceRefresh &&
		cachedProxySnapshot.length > 0 &&
		now - cachedAt < PROXY_CACHE_TTL_MS;

	if (cacheFresh) {
		return cachedProxySnapshot;
	}

	if (inFlightSnapshotFetch) {
		return inFlightSnapshotFetch;
	}

	inFlightSnapshotFetch = (async () => {
		const mode = env.PROXY_SOURCE_MODE.trim().toLowerCase();
		const manual = parseProxyFile();

		// manual mode: always use provided file
		if (mode === "manual") {
			if (manual.length === 0) {
				throw new ValidationError(
					"PROXY_SOURCE_MODE=manual but PROXY_MANUAL_FILE is empty or not set",
				);
			}
			cachedProxySnapshot = manual;
			cachedAt = Date.now();
			logger.log(`Loaded ${manual.length} proxies from PROXY_MANUAL_FILE`);
			return manual;
		}

		// api/auto mode: use API if present
		const apiUrl = env.PROXY_API_URL?.trim();
		if (apiUrl) {
			logger.log("Fetching proxies from API...");
			const res = await fetch(apiUrl);
			if (!res.ok) {
				throw new ExternalServiceError(
					"Proxy API",
					`HTTP ${res.status}: ${res.statusText}`,
					res.status,
					{ url: apiUrl },
				);
			}

			const text = await res.text();
			const parsed = text
				.trim()
				.split("\n")
				.map((line) => normalizeProxy(line))
				.filter(Boolean);

			if (parsed.length > 0) {
				cachedProxySnapshot = parsed;
				cachedAt = Date.now();
				logger.log(`Loaded ${parsed.length} proxies from API`);
				return parsed;
			}
			logger.warn(
				"Proxy API returned no proxies, checking manual list fallback...",
			);
		}

		// auto fallback: manual file if API unavailable/empty
		if (manual.length > 0) {
			cachedProxySnapshot = manual;
			cachedAt = Date.now();
			logger.log(
				`Loaded ${manual.length} proxies from PROXY_MANUAL_FILE (fallback)`,
			);
			return manual;
		}

		throw new ValidationError(
			"No proxies available: configure PROXY_API_URL or PROXY_MANUAL_FILE",
		);
	})();

	try {
		return await inFlightSnapshotFetch;
	} finally {
		inFlightSnapshotFetch = null;
	}
}
