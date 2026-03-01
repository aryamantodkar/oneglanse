/**
 * Agent-only provider context using AsyncLocalStorage.
 *
 * This file imports node:async_hooks which is Node.js-only and must NEVER be
 * imported by packages/utils (shared with the web app / webpack).
 *
 * At module initialisation it installs a context getter into the shared logger
 * via setProviderContextGetter(), so every logger.* call inside a
 * runWithProvider() block is automatically prefixed with the provider label.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { setProviderContextGetter } from "@oneglanse/utils";

const providerStorage = new AsyncLocalStorage<string>();

// Wire the storage into the shared logger once at import time.
setProviderContextGetter(() => providerStorage.getStore());

export function runWithProvider<T>(provider: string, fn: () => Promise<T>): Promise<T> {
	return providerStorage.run(provider, fn);
}
