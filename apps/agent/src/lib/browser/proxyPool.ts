import { logger } from "../utils/logger.js";

let proxies: string[] = [];
let cursor = 0;
const badProxies = new Set<string>();

export async function fetchProxies(): Promise<void> {
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

  proxies = parsed;
  cursor = 0;
  badProxies.clear();

  logger.log(`Loaded ${proxies.length} proxies`);
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
  badProxies.add(proxy);
  const available = proxies.length - badProxies.size;
  logger.warn(
    `Marked proxy as bad: ${proxy} (${available}/${proxies.length} remaining)`
  );
}

export function getAvailableCount(): number {
  return proxies.length - badProxies.size;
}
