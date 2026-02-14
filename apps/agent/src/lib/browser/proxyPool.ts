import { logger } from "../utils/logger.js";
import fs from "node:fs";
import type { Provider } from "@onescope/types";
import type { FailureType } from "./pageHealthCheck.js";

// ── Types ────────────────────────────────────────────────────────────────

type FetchProxyOptions = {
  forceRefresh?: boolean;
  resetBadProxies?: boolean;
};

interface ProxyEvent {
  timestamp: number;
  success: boolean;
  failureType?: FailureType;
  provider?: Provider;
}

interface ProxyRecord {
  proxy: string;
  events: ProxyEvent[];
  cooldownUntil: number;
  consecutiveFailures: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const PROXY_CACHE_TTL_MS = Number(process.env.PROXY_CACHE_TTL_MS ?? 10_000);
const MAX_EVENTS = 20;
const DECAY_HALF_LIFE = 10 * 60 * 1000; // 10 minutes
const EXPLORATION_RATE = 0.2; // 20% chance to try a non-best proxy

// ── Module state ─────────────────────────────────────────────────────────

let proxies: string[] = [];
let proxyRecords: Map<string, ProxyRecord> = new Map();
let cachedProxySnapshot: string[] = [];
let cachedAt = 0;
let inFlightSnapshotFetch: Promise<string[]> | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeProxy(proxy: string): string {
  const trimmed = proxy.trim();
  return trimmed.replace(/^https?:\/\//, "").trim();
}

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
    logger.warn(`Failed to read PROXY_MANUAL_FILE (${filePath}): ${err?.message ?? err}`);
    return [];
  }
}

function getProxyScore(record: ProxyRecord): number {
  if (record.events.length === 0) return 0.5; // Unknown = neutral

  const now = Date.now();
  let weightedSuccesses = 0;
  let weightedTotal = 0;

  for (const event of record.events) {
    const age = now - event.timestamp;
    const weight = Math.pow(0.5, age / DECAY_HALF_LIFE);
    weightedTotal += weight;
    if (event.success) weightedSuccesses += weight;
  }

  if (weightedTotal === 0) return 0.5;
  return weightedSuccesses / weightedTotal;
}

function getCooldownMs(
  failureType: FailureType | undefined,
  consecutiveFailures: number
): number {
  const failures = Math.max(1, consecutiveFailures);
  switch (failureType) {
    case "rate_limited":
      // Proxy is probably good, just needs time
      return Math.min(30_000 * Math.pow(2, failures - 1), 5 * 60 * 1000);
    case "bot_detection":
      // IP is flagged — longer cooldown
      return Math.min(60_000 * Math.pow(2, failures - 1), 15 * 60 * 1000);
    case "connection_error":
      // Proxy might be dead
      return Math.min(10_000 * Math.pow(2, failures - 1), 10 * 60 * 1000);
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

// ── Proxy snapshot fetching ──────────────────────────────────────────────

async function fetchProxySnapshot(forceRefresh = false): Promise<string[]> {
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
        throw new Error("PROXY_SOURCE_MODE=manual but PROXY_MANUAL_FILE is empty or not set");
      }
      cachedProxySnapshot = manual;
      cachedAt = Date.now();
      logger.log(`Loaded ${manual.length} proxies from PROXY_MANUAL_FILE`);
      return manual;
    }

    // api/auto mode: use API if present
    const apiUrl = process.env.PROXY_API_URL?.trim();
    if (apiUrl) {
      logger.log(`Fetching proxies from API...`);
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
      logger.warn("Proxy API returned no proxies, checking manual list fallback...");
    }

    // auto fallback: manual file if API unavailable/empty
    if (manual.length > 0) {
      cachedProxySnapshot = manual;
      cachedAt = Date.now();
      logger.log(`Loaded ${manual.length} proxies from PROXY_MANUAL_FILE (fallback)`);
      return manual;
    }

    throw new Error("No proxies available: configure PROXY_API_URL or PROXY_MANUAL_FILE");
  })();

  try {
    return await inFlightSnapshotFetch;
  } finally {
    inFlightSnapshotFetch = null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

export async function fetchProxies(
  options: FetchProxyOptions = {}
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

  // Get all proxies with the top score
  const topScore = candidates[0]!.score;
  const topScoredProxies = candidates.filter(c => c.score === topScore);

  // If multiple proxies have the same top score, pick randomly among them
  let pick: Candidate;
  if (topScoredProxies.length > 1) {
    // Random selection from equal-scored proxies
    const randomIdx = Math.floor(Math.random() * topScoredProxies.length);
    pick = topScoredProxies[randomIdx]!;
    logger.debug(`Randomly selected proxy from ${topScoredProxies.length} with score ${topScore.toFixed(2)}`);
  } else if (candidates.length > 1 && Math.random() < EXPLORATION_RATE) {
    // 20% chance to explore a lower-scored proxy (rediscover recovered proxies)
    const idx = 1 + Math.floor(Math.random() * (candidates.length - 1));
    pick = candidates[idx]!;
    logger.debug(`Exploring proxy with score ${pick.score.toFixed(2)} (exploration rate)`);
  } else {
    pick = candidates[0]!;
  }

  return `http://${pick.proxy}`;
}

export function recordProxyResult(
  proxy: string,
  success: boolean,
  failureType?: FailureType,
  provider?: Provider
): void {
  const normalized = normalizeProxy(proxy);
  let record = proxyRecords.get(normalized);

  if (!record) {
    record = { proxy: normalized, events: [], cooldownUntil: 0, consecutiveFailures: 0 };
    proxyRecords.set(normalized, record);
  }

  // Add event (ring buffer)
  record.events.push({ timestamp: Date.now(), success, failureType, provider });
  if (record.events.length > MAX_EVENTS) record.events.shift();

  if (success) {
    record.consecutiveFailures = 0;
    record.cooldownUntil = 0;
    logger.debug(`Proxy ${normalized} succeeded (score=${getProxyScore(record).toFixed(2)})`);
  } else {
    record.consecutiveFailures++;
    const cooldownMs = getCooldownMs(failureType, record.consecutiveFailures);
    record.cooldownUntil = Date.now() + cooldownMs;

    const score = getProxyScore(record);
    const available = getAvailableCount();
    logger.warn(
      `Proxy ${normalized} failed (${failureType ?? "unknown"}), ` +
      `score=${score.toFixed(2)}, cooldown=${(cooldownMs / 1000).toFixed(0)}s, ` +
      `${available} proxies available`
    );
  }
}

/** @deprecated Use recordProxyResult() instead */
export function markProxyBad(proxy: string): void {
  recordProxyResult(proxy, false, "unknown");
}

export function getAvailableCount(): number {
  const now = Date.now();
  let available = 0;
  for (const raw of proxies) {
    const normalized = normalizeProxy(raw);
    const record = proxyRecords.get(normalized);
    if (!record || record.cooldownUntil <= now) available++;
  }
  return available;
}

export function clearProxyPool(): void {
  proxies = [];
  proxyRecords = new Map();
}
