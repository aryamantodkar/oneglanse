import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import {
	logger,
	PROVIDER_FORCE_EXIT_STABLE_MS,
	PROVIDER_NO_OUTPUT_TIMEOUT_MS,
} from "@oneglanse/utils";
import {
	getGenerationStateSignature,
	hasVisibleGenerationIndicator,
} from "./isGenerating.js";

async function sleep(ms: number): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | null = null;
	try {
		await new Promise<void>((resolve) => {
			timer = setTimeout(resolve, ms);
		});
	} finally {
		if (timer !== null) {
			clearTimeout(timer);
		}
	}
}

// Shared polling helper - DRY principle
async function pollUntilCondition(
	checkFn: () => Promise<boolean>,
	pollInterval: number,
	maxWait: number,
	timeoutError: ExternalServiceError,
): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < maxWait) {
		if (await checkFn()) return;
		await sleep(pollInterval);
	}
	throw timeoutError;
}

export async function waitForAssistantToFinish(
	page: Page,
	provider: Provider,
): Promise<void> {
	logger.debug("⏳ Waiting for assistant to finish…");
	const waitStart = Date.now();
	let lastState = "";
	let lastChangeAt = Date.now();
	let initialized = false;

	await pollUntilCondition(
		async () => {
			const [currentState, hasVisibleIndicator] = await Promise.all([
				getGenerationStateSignature(page, provider),
				hasVisibleGenerationIndicator(page, provider),
			]);
			const waitedFor = Date.now() - waitStart;
			const forceExitStableMs = PROVIDER_FORCE_EXIT_STABLE_MS[provider];

			if (!initialized) {
				lastState = currentState;
				lastChangeAt = Date.now();
				initialized = true;
				return false;
			}

			if (currentState !== lastState) {
				lastState = currentState;
				lastChangeAt = Date.now();
				return false;
			}

			const stableFor = Date.now() - lastChangeAt;
			if (!hasVisibleIndicator && stableFor >= 1500) {
				logger.debug("✅ Assistant finished");
				return true;
			}

			const noOutputTimeoutMs = PROVIDER_NO_OUTPUT_TIMEOUT_MS[provider];
			if (waitedFor >= noOutputTimeoutMs) {
				logger.warn(
					`Generation state did not stabilize within ${Math.round(noOutputTimeoutMs / 1000)}s`,
				);
			}

			if (stableFor >= forceExitStableMs) {
				logger.warn(
					`${hasVisibleIndicator ? "Generation indicator still visible and " : ""}generation state stable for ${Math.round(forceExitStableMs / 1000)}s — forcing exit`,
				);
				return true;
			}

			return false;
		},
		280 + Math.floor(Math.random() * 60), // Poll ~300ms with ±50ms jitter
		5 * 60 * 1000, // 5 min max — if a response hasn't arrived by then, something is wrong
		new ExternalServiceError(provider, "Assistant wait timed out"),
	);
}
