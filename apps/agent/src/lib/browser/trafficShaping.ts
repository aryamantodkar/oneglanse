import type { Provider } from "@oneglanse/types";
import { logger } from "@oneglanse/utils";

type Gate = {
	active: number;
	queue: Array<() => void>;
};

function createGate(): Gate {
	return { active: 0, queue: [] };
}

async function acquire(gate: Gate, maxActive: number): Promise<() => void> {
	if (gate.active < maxActive) {
		gate.active += 1;
		return () => release(gate);
	}

	await new Promise<void>((resolve) => {
		gate.queue.push(() => {
			gate.active += 1;
			resolve();
		});
	});

	return () => release(gate);
}

function release(gate: Gate): void {
	if (gate.active > 0) gate.active -= 1;
	const next = gate.queue.shift();
	if (next) next();
}

function randomDelayMs(minMs: number, maxMs: number): number {
	if (maxMs <= minMs) return Math.max(0, minMs);
	return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

async function runWithGate<T>(
	provider: Provider,
	actionLabel: string,
	gate: Gate,
	maxActive: number,
	minDelayMs: number,
	maxDelayMs: number,
	fn: () => Promise<T>,
): Promise<T> {
	const unlock = await acquire(gate, maxActive);
	try {
		const delay = randomDelayMs(minDelayMs, maxDelayMs);
		if (delay > 0) {
			logger.debug(
				`[${provider}] pacing ${actionLabel} with ${delay}ms delay`,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		return await fn();
	} finally {
		unlock();
	}
}

const navigationGate = createGate();
const submitGate = createGate();

// Residential proxies are sensitive to synchronized startup bursts.
const MAX_CONCURRENT_NAVIGATIONS = 2;
const NAVIGATION_DELAY_MIN_MS = 1_200;
const NAVIGATION_DELAY_MAX_MS = 4_000;

// Serialized submits reduce cross-provider "bot burst" signatures.
const MAX_CONCURRENT_SUBMITS = 1;
const SUBMIT_DELAY_MIN_MS = 800;
const SUBMIT_DELAY_MAX_MS = 2_200;

export async function withNavigationThrottle<T>(
	provider: Provider,
	fn: () => Promise<T>,
): Promise<T> {
	return runWithGate(
		provider,
		"navigation",
		navigationGate,
		MAX_CONCURRENT_NAVIGATIONS,
		NAVIGATION_DELAY_MIN_MS,
		NAVIGATION_DELAY_MAX_MS,
		fn,
	);
}

export async function withSubmitThrottle<T>(
	provider: Provider,
	fn: () => Promise<T>,
): Promise<T> {
	return runWithGate(
		provider,
		"submit",
		submitGate,
		MAX_CONCURRENT_SUBMITS,
		SUBMIT_DELAY_MIN_MS,
		SUBMIT_DELAY_MAX_MS,
		fn,
	);
}
