import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { getProviderSessionScope } from "../lib/browser/providerScope.js";

export const MAX_PARALLEL_PROVIDER_JOBS = 2;

// Bounded random jitter applied before each provider starts so that concurrent
// jobs do not all spin up browsers simultaneously and spike CPU/memory.
const STARTUP_JITTER_MAX_MS = 3_000;

const slotWaiters: Array<() => void> = [];
const familyWaiters = new Map<string, Array<() => void>>();
const activeFamilies = new Set<string>();
let activeJobCount = 0;

async function acquireGlobalSlot(): Promise<void> {
	if (activeJobCount < MAX_PARALLEL_PROVIDER_JOBS) {
		activeJobCount += 1;
		return;
	}

	await new Promise<void>((resolve) => {
		slotWaiters.push(resolve);
	});
	activeJobCount += 1;
}

function releaseGlobalSlot(): void {
	activeJobCount = Math.max(0, activeJobCount - 1);
	const next = slotWaiters.shift();
	next?.();
}

async function acquireFamilySlot(family: string): Promise<void> {
	if (!activeFamilies.has(family)) {
		activeFamilies.add(family);
		return;
	}

	await new Promise<void>((resolve) => {
		const waiters = familyWaiters.get(family) ?? [];
		waiters.push(resolve);
		familyWaiters.set(family, waiters);
	});
}

function releaseFamilySlot(family: string): void {
	const waiters = familyWaiters.get(family);
	const next = waiters?.shift();
	if (next) {
		next();
		return;
	}

	familyWaiters.delete(family);
	activeFamilies.delete(family);
}

export async function runWithProviderExecutionGate<T>(
	provider: Provider,
	task: () => Promise<T>,
): Promise<T> {
	const family = getProviderSessionScope(provider);

	const jitter = Math.floor(Math.random() * STARTUP_JITTER_MAX_MS);
	if (jitter > 0) {
		await new Promise<void>((resolve) => setTimeout(resolve, jitter));
	}

	await acquireFamilySlot(family);
	await acquireGlobalSlot();

	logger.log(`[${provider}] execution started`);

	try {
		return await task();
	} finally {
		releaseGlobalSlot();
		releaseFamilySlot(family);
	}
}
