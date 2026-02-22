import fs from "node:fs";
import { logger } from "../../utils/logger.js";
import { normalizeProxy } from "./scoring.js";

// ── Constants ────────────────────────────────────────────────────────────

const PROXY_CACHE_TTL_MS = Number(process.env.PROXY_CACHE_TTL_MS ?? 10_000);

// ── Cache state ───────────────────────────────────────────────────────────

let cachedProxySnapshot: string[] = [];
let cachedAt = 0;
let inFlightSnapshotFetch: Promise<string[]> | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function parseProxyFile(): string[] {
	const filePath = process.env.PROXY_MANUAL_FILE?.trim();
	if (!filePath) return [];

	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const list = content
			.split(/\r?\n/)
			.map((line) => normalizeProxy(line))
			.filter(Boolean);
		return list;
	} catch (err: any) {
		logger.warn(
			`Failed to read PROXY_MANUAL_FILE (${filePath}): ${err?.message ?? err}`,
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
		const mode = (process.env.PROXY_SOURCE_MODE ?? "auto").trim().toLowerCase();
		const manual = parseProxyFile();

		// manual mode: always use provided file
		if (mode === "manual") {
			if (manual.length === 0) {
				throw new Error(
					"PROXY_SOURCE_MODE=manual but PROXY_MANUAL_FILE is empty or not set",
				);
			}
			cachedProxySnapshot = manual;
			cachedAt = Date.now();
			logger.log(`Loaded ${manual.length} proxies from PROXY_MANUAL_FILE`);
			return manual;
		}

		// api/auto mode: use API if present
		const apiUrl = process.env.PROXY_API_URL?.trim();
		if (apiUrl) {
			logger.log("Fetching proxies from API...");
			const res = await fetch(apiUrl);
			if (!res.ok) {
				throw new Error(`Proxy API returned ${res.status}: ${res.statusText}`);
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

		throw new Error(
			"No proxies available: configure PROXY_API_URL or PROXY_MANUAL_FILE",
		);
	})();

	try {
		return await inFlightSnapshotFetch;
	} finally {
		inFlightSnapshotFetch = null;
	}
}
