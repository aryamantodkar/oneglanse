import type { Browser, BrowserContext, Page } from "playwright";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";

export type WarmEntry = {
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy: string | null;
	cleanup: (() => Promise<void>) | null;
	storedAt: number;
};

const WARM_TTL_MS = 5 * 60 * 1000; // 5 minutes

const pool = new Map<Provider, WarmEntry>();

/**
 * Retrieve and remove a warm browser entry for the given provider.
 * Returns null if the entry is absent, expired, or the page is no longer alive.
 */
export async function getWarmBrowser(provider: Provider): Promise<WarmEntry | null> {
	const entry = pool.get(provider);
	if (!entry) return null;

	if (Date.now() - entry.storedAt > WARM_TTL_MS) {
		logger.debug(`[warmPool:${provider}] TTL expired, evicting.`);
		await evictWarmBrowser(provider);
		return null;
	}

	const alive = await Promise.race([
		entry.page.evaluate(() => true).then(
			() => true,
			() => false,
		),
		new Promise<false>((r) => setTimeout(() => r(false), 3_000)),
	]);

	if (!alive) {
		logger.debug(`[warmPool:${provider}] Page unresponsive, evicting.`);
		await evictWarmBrowser(provider);
		return null;
	}

	pool.delete(provider);
	logger.log(`[warmPool:${provider}] Reusing warm browser.`);
	return entry;
}

/**
 * Store a healthy browser in the warm pool for the given provider.
 * Evicts any previously stored entry for that provider first.
 */
export async function storeWarmBrowser(provider: Provider, entry: WarmEntry): Promise<void> {
	const existing = pool.get(provider);
	if (existing) {
		await _close(existing);
	}
	pool.set(provider, entry);
	logger.debug(`[warmPool:${provider}] Stored warm browser.`);
}

/**
 * Evict and close the warm browser for the given provider, if any.
 */
export async function evictWarmBrowser(provider: Provider): Promise<void> {
	const entry = pool.get(provider);
	if (!entry) return;
	pool.delete(provider);
	await _close(entry);
}

/**
 * Close all warm browsers in the pool. Called during graceful shutdown.
 */
export async function closeAllWarm(): Promise<void> {
	await Promise.all([...pool.keys()].map(evictWarmBrowser));
}

async function _close(entry: WarmEntry): Promise<void> {
	await entry.cleanup?.().catch(() => {});
	await entry.context?.close().catch(() => {});
	await entry.browser?.close().catch(() => {});
}
