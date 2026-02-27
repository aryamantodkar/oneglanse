import type { FailureType, Provider } from "@oneglanse/types";
import { logger } from "../../utils/logger.js";
import {
	EXPLORATION_RATE,
	MAX_EVENTS,
	type ProxyRecord,
	getCooldownMs,
	getProxyScore,
	normalizeProxy,
} from "./scoring.js";
import { fetchProxySnapshot } from "./snapshot.js";
import { NotFoundError } from "@oneglanse/errors";

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
	const snapshot = await fetchProxySnapshot(Boolean(options.forceRefresh));
	proxies = [...snapshot];

	if (options.resetBadProxies) {
		proxyRecords.clear();
	} else if (proxyRecords.size > 0) {
		// Retain only records for proxies that still exist in the new snapshot
		const proxySet = new Set(proxies.map(normalizeProxy));
		for (const [key] of proxyRecords) {
			if (!proxySet.has(key)) proxyRecords.delete(key);
		}
	}
}

export function getNextProxy(): string | null {
	const now = Date.now();

	type Candidate = { proxy: string; score: number };
	const candidates: Candidate[] = [];

	for (const raw of proxies) {
		const normalized = normalizeProxy(raw);
		const record = proxyRecords.get(normalized);

		// Skip proxies in cooldown
		if (record && record.cooldownUntil > now) continue;

		const score = record ? getProxyScore(record) : 0.5;
		candidates.push({ proxy: normalized, score });
	}

	if (candidates.length === 0) return null;

	// Sort by score descending
	candidates.sort((a, b) => b.score - a.score);

	const topScore = candidates[0]?.score ?? 0;
	
	const topScoredProxies = candidates.filter((c) => c.score === topScore);

	// If multiple proxies have the same top score, pick randomly among them
	let pick: Candidate;
	if (topScoredProxies.length > 1) {
		// Random selection from equal-scored proxies
		const randomIdx = Math.floor(Math.random() * topScoredProxies.length);
		pick = topScoredProxies[randomIdx]!;
		logger.debug(
			`Randomly selected proxy from ${topScoredProxies.length} with score ${topScore.toFixed(2)}`,
		);
	} else if (candidates.length > 1 && Math.random() < EXPLORATION_RATE) {
		// 20% chance to explore a lower-scored proxy (rediscover recovered proxies)
		const idx = 1 + Math.floor(Math.random() * (candidates.length - 1));
		pick = candidates[idx]!;
		logger.debug(
			`Exploring proxy with score ${pick.score.toFixed(2)} (exploration rate)`,
		);
	} else {
		pick = candidates[0]!;
	}

	return `http://${pick.proxy}`;
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
	const now = Date.now();
	let available = 0;
	for (const raw of proxies) {
		const normalized = normalizeProxy(raw);
		const record = proxyRecords.get(normalized);
		if (!record || record.cooldownUntil <= now) available++;
	}
	return available;
}

function clearProxyPool(): void {
	proxies = [];
	proxyRecords = new Map();
}
