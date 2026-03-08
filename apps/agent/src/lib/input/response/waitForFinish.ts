import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import {
	logger,
	PROVIDER_FORCE_EXIT_STABLE_MS,
	PROVIDER_NO_OUTPUT_TIMEOUT_MS,
} from "@oneglanse/utils";
import { getText } from "./getText.js";
import { isGenerating } from "./isGenerating.js";

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
	// Chat models (ChatGPT, Claude, Perplexity, Gemini)
	const waitStart = Date.now();
	let lastText = "";
	let lastChange = Date.now();
	let seenOutput = false;

	await pollUntilCondition(
		async () => {
			const [generating, text] = await Promise.all([
				isGenerating(page, provider),
				getText(page, provider),
			]);

			// Track output — require meaningful content to avoid placeholder divs
			if (text.length >= 20) seenOutput = true;

			// Track changes
			if (text !== lastText) {
				lastText = text;
				lastChange = Date.now();
			}

			const stableFor = Date.now() - lastChange;
			const noOutputFor = Date.now() - waitStart;

			// Error: No output after the provider-specific grace period.
			if (!seenOutput && noOutputFor >= PROVIDER_NO_OUTPUT_TIMEOUT_MS[provider]) {
				throw new ExternalServiceError(
					provider,
					`No response detected after ${Math.round(PROVIDER_NO_OUTPUT_TIMEOUT_MS[provider] / 1000)}s`,
				);
			}

			// Still generating and no output yet - keep waiting
			if (generating && !seenOutput) return false;

			// Success: output seen + not generating + stable for 1.5s
			if (seenOutput && !generating && stableFor >= 1500) {
				logger.debug("✅ Assistant finished");
				return true;
			}

			// Force exit: long text stability handles stuck generation indicators
			// without cutting off legitimate long-think responses too early.
			if (seenOutput && stableFor >= PROVIDER_FORCE_EXIT_STABLE_MS[provider]) {
				logger.warn(
					`Text stable ${Math.round(PROVIDER_FORCE_EXIT_STABLE_MS[provider] / 1000)}s but still generating — forcing exit`,
				);
				return true;
			}

			return false;
		},
		300, // Poll every 300ms
		20 * 60 * 1000, // 20 min max
		new ExternalServiceError(provider, "Assistant wait timed out"),
	);
}
