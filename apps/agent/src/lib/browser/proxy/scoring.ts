import type { FailureType } from "@oneglanse/types";
import type { Provider } from "@oneglanse/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface ProxyEvent {
	timestamp: number;
	success: boolean;
	failureType?: FailureType;
	provider?: Provider;
}

export interface ProxyRecord {
	proxy: string;
	events: ProxyEvent[];
	cooldownUntil: number;
	consecutiveFailures: number;
}

// ── Constants ────────────────────────────────────────────────────────────

export const MAX_EVENTS = 20;
const DECAY_HALF_LIFE = 10 * 60 * 1000; // 10 minutes
export const EXPLORATION_RATE = 0.2; // 20% chance to try a non-best proxy

// ── Pure helpers ─────────────────────────────────────────────────────────

export function normalizeProxy(proxy: string): string {
	const trimmed = proxy.trim();
	if (!trimmed) return "";

	const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
	const candidate = hasScheme ? trimmed : `http://${trimmed}`;

	try {
		const parsed = new URL(candidate);
		const protocol = parsed.protocol.toLowerCase();
		if (!["http:", "https:", "socks5:"].includes(protocol)) return "";
		if (!parsed.hostname || !parsed.port) return "";

		const auth =
			parsed.username || parsed.password
				? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
				: "";
		const host =
			parsed.hostname.includes(":") && !parsed.hostname.startsWith("[")
				? `[${parsed.hostname}]`
				: parsed.hostname;
		return `${protocol}//${auth}${host}:${parsed.port}`;
	} catch {
		return "";
	}
}

export function getProxyScore(record: ProxyRecord): number {
	if (record.events.length === 0) return 0.5; // Unknown = neutral

	const now = Date.now();
	let weightedSuccesses = 0;
	let weightedTotal = 0;

	for (const event of record.events) {
		const age = now - event.timestamp;
		const weight = 0.5 ** (age / DECAY_HALF_LIFE);
		weightedTotal += weight;
		if (event.success) weightedSuccesses += weight;
	}

	if (weightedTotal === 0) return 0.5;
	return weightedSuccesses / weightedTotal;
}

export function getCooldownMs(
	failureType: FailureType | undefined,
	consecutiveFailures: number,
): number {
	const failures = Math.max(1, consecutiveFailures);
	switch (failureType) {
		case "rate_limited":
			// Proxy is probably good, just needs time
			return Math.min(30_000 * 2 ** (failures - 1), 5 * 60 * 1000);
		case "bot_detection":
			// IP is flagged — longer cooldown
			return Math.min(60_000 * 2 ** (failures - 1), 15 * 60 * 1000);
		case "connection_error":
			// Proxy might be dead
			return Math.min(10_000 * 2 ** (failures - 1), 10 * 60 * 1000);
		case "logged_out":
			// Session issue on this IP
			return Math.min(30_000 * failures, 5 * 60 * 1000);
		case "no_editor":
			// Page loaded but wrong state
			return Math.min(20_000 * failures, 5 * 60 * 1000);
		default:
			return Math.min(15_000 * failures, 5 * 60 * 1000);
	}
}
