import { logger } from "../utils/logger.js";

type FetchProxyOptions = {
  forceRefresh?: boolean;
  resetBadProxies?: boolean;
};

const PROXY_CACHE_TTL_MS = Number(process.env.PROXY_CACHE_TTL_MS ?? 10_000);

let proxies: string[] = [];
let cursor = 0;
let badProxies = new Set<string>();
let cachedProxySnapshot: string[] = [];
let cachedAt = 0;
let inFlightSnapshotFetch: Promise<string[]> | null = null;

function normalizeProxy(proxy: string): string {
  const trimmed = proxy.trim();
  return trimmed.replace(/^https?:\/\//, "").trim();
}

function parseManualProxyList(): string[] {
  const raw = process.env.PROXY_MANUAL_LIST;
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((line) => normalizeProxy(line))
    .filter(Boolean);
}

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
    const manual = parseManualProxyList();

    // manual mode: always use provided list
    if (mode === "manual") {
      if (manual.length === 0) {
        throw new Error("PROXY_SOURCE_MODE=manual but PROXY_MANUAL_LIST is empty");
      }
      cachedProxySnapshot = manual;
      cachedAt = Date.now();
      logger.log(`Loaded ${manual.length} proxies from PROXY_MANUAL_LIST`);
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

    // auto fallback: manual list if API unavailable/empty
    if (manual.length > 0) {
      cachedProxySnapshot = manual;
      cachedAt = Date.now();
      logger.log(`Loaded ${manual.length} proxies from PROXY_MANUAL_LIST (fallback)`);
      return manual;
    }

    throw new Error("No proxies available: configure PROXY_API_URL or PROXY_MANUAL_LIST");
  })();

  try {
    return await inFlightSnapshotFetch;
  } finally {
    inFlightSnapshotFetch = null;
  }
}

export async function fetchProxies(
  options: FetchProxyOptions = {}
): Promise<void> {
  const snapshot = await fetchProxySnapshot(Boolean(options.forceRefresh));
  proxies = [...snapshot];
  cursor = 0;

  if (options.resetBadProxies) {
    badProxies.clear();
  } else if (badProxies.size > 0) {
    // Retain only bad proxies that still exist in the new snapshot.
    const retained = new Set<string>();
    for (const bad of badProxies) {
      if (proxies.includes(bad)) retained.add(bad);
    }
    badProxies.clear();
    retained.forEach((bad) => badProxies.add(bad));
  }
}

export function getNextProxy(): string | null {
  const total = proxies.length;
  if (total === 0) return null;

  for (let i = 0; i < total; i++) {
    const idx = (cursor + i) % total;
    const proxy = proxies[idx]!;
    if (!badProxies.has(proxy)) {
      cursor = (idx + 1) % total;
      return `http://${proxy}`;
    }
  }

  return null;
}

export function markProxyBad(proxy: string): void {
  const normalized = normalizeProxy(proxy);
  badProxies.add(normalized);
  const available = proxies.length - badProxies.size;
  logger.warn(
    `Marked proxy as bad: ${normalized} (${available}/${proxies.length} remaining)`
  );
}

export function getAvailableCount(): number {
  return proxies.length - badProxies.size;
}

export function clearProxyPool(): void {
  proxies = [];
  cursor = 0;
  badProxies = new Set<string>();
}
