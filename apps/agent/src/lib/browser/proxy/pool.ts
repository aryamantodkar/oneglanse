import type { FailureType, Provider } from "@oneglanse/types";
import { ValidationError } from "@oneglanse/errors";
import { logger } from "@oneglanse/utils";
import { env } from "../../../env.js";
import {
	MAX_EVENTS,
	type ProxyRecord,
	getCooldownMs,
	getProxyScore,
	normalizeProxy,
} from "./scoring.js";

// ── Types ─────────────────────────────────────────────────────────────────

type FetchProxyOptions = {
	forceRefresh?: boolean;
	resetBadProxies?: boolean;
};

// ── Pool state ────────────────────────────────────────────────────────────

let proxies: string[] = [];
let proxyRecords: Map<string, ProxyRecord> = new Map();

// ── Public API ────────────────────────────────────────────────────────────

export async function fetchProxies(
	options: FetchProxyOptions = {},
): Promise<void> {
	const rawProxy = env.PROXY?.trim();
	if (!rawProxy) {
		throw new ValidationError(
			"PROXY is not set. Configure PROXY (and optional PROXY_USERNAME/PROXY_PASSWORD).",
		);
	}

	const normalized = normalizeProxy(rawProxy);
	if (!normalized) {
		throw new ValidationError(
			"PROXY is invalid. Expected host:port or http(s)/socks5://host:port",
		);
	}

	if (normalized.includes("@")) {
		throw new ValidationError(
			"PROXY must not include credentials. Use PROXY_USERNAME and PROXY_PASSWORD instead.",
		);
	}

	proxies = [normalized];

	if (options.resetBadProxies) {
		proxyRecords.clear();
	} else if (proxyRecords.size > 0) {
		// Retain only records for proxies that still exist in the current config
		const proxySet = new Set(proxies.map(normalizeProxy));
		for (const [key] of proxyRecords) {
			if (!proxySet.has(key)) proxyRecords.delete(key);
		}
	}
}

export function getNextProxy(): string | null {
	if (proxies.length === 0) return null;

	const normalized = normalizeProxy(proxies[0] ?? "");
	if (!normalized) return null;

	const record = proxyRecords.get(normalized);
	if (record && record.cooldownUntil > Date.now()) {
		const remainingSeconds = Math.ceil((record.cooldownUntil - Date.now()) / 1000);
		logger.debug(
			`Proxy ${normalized} is in cooldown (${remainingSeconds}s remaining) — reusing in direct mode`,
		);
	}

	return normalized;
}

export function recordProxyResult(
	proxy: string,
	success: boolean,
	failureType?: FailureType,
	provider?: Provider,
): void {
	const normalized = normalizeProxy(proxy);
	let record = proxyRecords.get(normalized);

	if (!record) {
		record = {
			proxy: normalized,
			events: [],
			cooldownUntil: 0,
			consecutiveFailures: 0,
		};
		proxyRecords.set(normalized, record);
	}

	// Add event (ring buffer)
	record.events.push({ timestamp: Date.now(), success, failureType, provider });
	if (record.events.length > MAX_EVENTS) record.events.shift();

	if (success) {
		record.consecutiveFailures = 0;
		record.cooldownUntil = 0;
		logger.debug(
			`Proxy ${normalized} succeeded (score=${getProxyScore(record).toFixed(2)})`,
		);
	} else {
		record.consecutiveFailures++;
		const cooldownMs = getCooldownMs(failureType, record.consecutiveFailures);
		record.cooldownUntil = Date.now() + cooldownMs;

		const score = getProxyScore(record);
		const available = getAvailableCount();
		logger.warn(
			`Proxy ${normalized} failed (${failureType ?? "unknown"}), ` +
				`score=${score.toFixed(2)}, cooldown=${(cooldownMs / 1000).toFixed(0)}s, ` +
				`${available} proxies available`,
		);
	}
}

function getAvailableCount(): number {
	return proxies.length > 0 ? 1 : 0;
}

function clearProxyPool(): void {
	proxies = [];
	proxyRecords = new Map();
}
