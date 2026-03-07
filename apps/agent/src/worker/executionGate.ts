import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import {
	getProviderSessionScope,
	getProviderStartupDelayRange,
} from "../lib/browser/providerScope.js";

export const MAX_PARALLEL_PROVIDER_JOBS = 2;

const slotWaiters: Array<() => void> = [];
const familyWaiters = new Map<string, Array<() => void>>();
const activeFamilies = new Set<string>();
let activeJobCount = 0;

function randomBetween(min: number, max: number): number {
	if (max <= min) return min;
	return min + Math.floor(Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

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
	const { minMs, maxMs } = getProviderStartupDelayRange(provider);
	const startupDelayMs = randomBetween(minMs, maxMs);
	const family = getProviderSessionScope(provider);

	if (startupDelayMs > 0) {
		logger.log(
			`[${provider}] staggering start by ${(startupDelayMs / 1000).toFixed(1)}s to reduce burst patterns`,
		);
		await sleep(startupDelayMs);
	}

	await acquireFamilySlot(family);
	await acquireGlobalSlot();

	try {
		return await task();
	} finally {
		releaseGlobalSlot();
		releaseFamilySlot(family);
	}
}
