import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import type { Browser, BrowserContext, Page } from "playwright";

export type WarmEntry = {
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy: string | null;
	cleanup: (() => Promise<void>) | null;
	storedAt: number;
};

const WARM_TTL_MS = 5 * 60 * 1000; // 5 minutes

const pool = new Map<string, WarmEntry>();

function buildPoolKey(sessionKey: string): string {
	return sessionKey;
}

/**
 * Retrieve and remove a warm browser entry for the given provider.
 * Returns null if the entry is absent, expired, or the page is no longer alive.
 */
export async function getWarmBrowser(
	provider: Provider,
	sessionKey: string,
): Promise<WarmEntry | null> {
	const key = buildPoolKey(sessionKey);
	const entry = pool.get(key);
	if (!entry) return null;

	if (Date.now() - entry.storedAt > WARM_TTL_MS) {
		logger.debug(`[warmPool:${provider}] TTL expired, evicting.`);
		await evictWarmBrowser(provider, sessionKey);
		return null;
	}

	const alive = await Promise.race([
		entry.page
			.evaluate(() => true)
			.then(
				() => true,
				() => false,
			),
		new Promise<false>((r) => setTimeout(() => r(false), 3_000)),
	]);

	if (!alive) {
		logger.debug(`[warmPool:${provider}] Page unresponsive, evicting.`);
		await evictWarmBrowser(provider, sessionKey);
		return null;
	}

	pool.delete(key);
	logger.log(`[warmPool:${provider}] Reusing warm browser.`);
	return entry;
}

/**
 * Store a healthy browser in the warm pool for the given provider.
 * Evicts any previously stored entry for that provider first.
 */
export async function storeWarmBrowser(
	provider: Provider,
	sessionKey: string,
	entry: WarmEntry,
): Promise<void> {
	const key = buildPoolKey(sessionKey);
	const existing = pool.get(key);
	if (existing) {
		await _close(existing);
	}
	pool.set(key, entry);
	logger.debug(`[warmPool:${provider}] Stored warm browser.`);
}

/**
 * Evict and close the warm browser for the given provider, if any.
 */
export async function evictWarmBrowser(
	provider: Provider,
	sessionKey: string,
): Promise<void> {
	const key = buildPoolKey(sessionKey);
	const entry = pool.get(key);
	if (!entry) return;
	pool.delete(key);
	await _close(entry);
}

/**
 * Close all warm browsers in the pool. Called during graceful shutdown.
 */
export async function closeAllWarm(): Promise<void> {
	const entries = [...pool.entries()];
	pool.clear();
	await Promise.all(entries.map(([, entry]) => _close(entry)));
}

async function _close(entry: WarmEntry): Promise<void> {
	await entry.cleanup?.().catch(() => {});
	await entry.context?.close().catch(() => {});
	await entry.browser?.close().catch(() => {});
}
