import { logger } from "../utils/logger.js";

type ProxyPoolState = {
  proxies: string[];
  cursor: number;
  badProxies: Set<string>;
};

type FetchProxyOptions = {
  forceRefresh?: boolean;
  resetBadProxies?: boolean;
};

const DEFAULT_POOL_ID = "default";
const PROXY_CACHE_TTL_MS = Number(process.env.PROXY_CACHE_TTL_MS ?? 10_000);

const pools = new Map<string, ProxyPoolState>();
let cachedProxySnapshot: string[] = [];
let cachedAt = 0;
let inFlightSnapshotFetch: Promise<string[]> | null = null;

function getPool(poolId = DEFAULT_POOL_ID): ProxyPoolState {
  let pool = pools.get(poolId);
  if (!pool) {
    pool = {
      proxies: [],
      cursor: 0,
      badProxies: new Set<string>(),
    };
    pools.set(poolId, pool);
  }
  return pool;
}

function normalizeProxy(proxy: string): string {
  return proxy.replace(/^https?:\/\//, "").trim();
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
    if (!process.env.PROXY_API_URL) {
      throw new Error("PROXY_API_URL is not set");
    }
    const apiUrl = process.env.PROXY_API_URL;

    logger.log(`Fetching proxies from API...`);

    const res = await fetch(apiUrl);

    if (!res.ok) {
      throw new Error(`Proxy API returned ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    const parsed = text
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      throw new Error("Proxy API returned no proxies");
    }

    cachedProxySnapshot = parsed;
    cachedAt = Date.now();

    logger.log(`Loaded ${parsed.length} proxies`);
    return parsed;
  })();

  try {
    return await inFlightSnapshotFetch;
  } finally {
    inFlightSnapshotFetch = null;
  }
}

export async function fetchProxies(
  poolId = DEFAULT_POOL_ID,
  options: FetchProxyOptions = {}
): Promise<void> {
  const pool = getPool(poolId);
  const snapshot = await fetchProxySnapshot(Boolean(options.forceRefresh));
  pool.proxies = [...snapshot];
  pool.cursor = 0;

  if (options.resetBadProxies) {
    pool.badProxies.clear();
  } else if (pool.badProxies.size > 0) {
    // Retain only bad proxies that still exist in the new snapshot.
    const retained = new Set<string>();
    for (const bad of pool.badProxies) {
      if (pool.proxies.includes(bad)) retained.add(bad);
    }
    pool.badProxies.clear();
    retained.forEach((bad) => pool.badProxies.add(bad));
  }
}

export function getNextProxy(poolId = DEFAULT_POOL_ID): string | null {
  const pool = getPool(poolId);
  const total = pool.proxies.length;
  if (total === 0) return null;

  for (let i = 0; i < total; i++) {
    const idx = (pool.cursor + i) % total;
    const proxy = pool.proxies[idx]!;
    if (!pool.badProxies.has(proxy)) {
      pool.cursor = (idx + 1) % total;
      return `http://${proxy}`;
    }
  }

  return null;
}

export function markProxyBad(proxy: string, poolId = DEFAULT_POOL_ID): void {
  const pool = getPool(poolId);
  const normalized = normalizeProxy(proxy);
  pool.badProxies.add(normalized);
  const available = pool.proxies.length - pool.badProxies.size;
  logger.warn(
    `Marked proxy as bad (${poolId}): ${normalized} (${available}/${pool.proxies.length} remaining)`
  );
}

export function getAvailableCount(poolId = DEFAULT_POOL_ID): number {
  const pool = getPool(poolId);
  return pool.proxies.length - pool.badProxies.size;
}

export function clearProxyPool(poolId = DEFAULT_POOL_ID): void {
  pools.delete(poolId);
}
