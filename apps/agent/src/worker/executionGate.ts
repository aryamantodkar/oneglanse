import { resolveAppMode } from "@oneglanse/types";
import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import { env } from "../env.js";

export const MAX_PARALLEL_PROVIDER_JOBS =
	resolveAppMode(env.ONEGLANSE_APP_MODE) === "local" ? 1 : 2;

// Bounded random jitter applied before each provider starts so that concurrent
// jobs do not all spin up browsers simultaneously and spike CPU/memory.
const STARTUP_JITTER_MAX_MS = 3_000;

const slotWaiters: Array<() => void> = [];
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

export async function runWithProviderExecutionGate<T>(
	provider: Provider,
	task: () => Promise<T>,
): Promise<T> {
	const jitter = Math.floor(Math.random() * STARTUP_JITTER_MAX_MS);
	if (jitter > 0) {
		await new Promise<void>((resolve) => setTimeout(resolve, jitter));
	}

	await acquireGlobalSlot();

	logger.log(`[${provider}] execution started`);

	try {
		return await task();
	} finally {
		releaseGlobalSlot();
	}
}
