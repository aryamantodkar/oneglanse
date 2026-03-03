import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { logger } from "@oneglanse/utils";
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
	let lastText = "";
	let lastChange = Date.now();
	let seenOutput = false;

	await pollUntilCondition(
		async () => {
			const [generating, text] = await Promise.all([
				isGenerating(page),
				getText(page, provider),
			]);

			// Track output
			if (text.length > 0) seenOutput = true;

			// Track changes
			if (text !== lastText) {
				lastText = text;
				lastChange = Date.now();
			}

			const stableFor = Date.now() - lastChange;
			const elapsed = Date.now() - lastChange;

			// Error: No output after 45s
			if (!seenOutput && elapsed >= 45_000) {
				throw new ExternalServiceError(provider, "No response detected after 45s");
			}

			// Still generating and no output yet - keep waiting
			if (generating && !seenOutput) return false;

			// Success: output seen + not generating + stable for 1.5s
			if (seenOutput && !generating && stableFor >= 1500) {
				logger.debug("✅ Assistant finished");
				return true;
			}

			// Force exit: stable for 15s (handles stuck generation indicators)
			if (seenOutput && stableFor >= 15_000) {
				logger.warn("Text stable 15s but still generating — forcing exit");
				return true;
			}

			return false;
		},
		300, // Poll every 300ms
		20 * 60 * 1000, // 20 min max
		new ExternalServiceError(provider, "Assistant wait timed out"),
	);
}
