import { ExternalServiceError } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import {
	DEFAULT_MIN_RESPONSE_CHARS,
	PROVIDER_FORCE_EXIT_STABLE_MS,
	PROVIDER_NO_OUTPUT_TIMEOUT_MS,
	PROVIDER_MIN_RESPONSE_CHARS,
	logger,
} from "@oneglanse/utils";
import type { Page } from "playwright";
import {
	disposeResponseMonitor,
	readResponseProbe,
	resetResponseMonitor,
} from "./responseMonitor.js";

const RESPONSE_QUIESCENCE_MS = 1_500;

export async function waitForAssistantToFinish(
	page: Page,
	provider: Provider,
): Promise<void> {
	logger.debug("⏳ Waiting for assistant to finish…");

	let lastText = "";
	let lastTextChangeAt = Date.now();
	let seenRelevantMutation = false;
	let seenOutput = false;
	const waitStartedAt = Date.now();
	const noOutputTimeoutMs = PROVIDER_NO_OUTPUT_TIMEOUT_MS[provider];
	const forceExitStableMs = PROVIDER_FORCE_EXIT_STABLE_MS[provider];
	const minResponseChars =
		PROVIDER_MIN_RESPONSE_CHARS[provider] ?? DEFAULT_MIN_RESPONSE_CHARS;
	const substantiveTextThreshold = Math.max(10, Math.min(minResponseChars, 40));

	try {
		await resetResponseMonitor(page);

		const pollIntervalMs = 250;
		const timeoutAt = Date.now() + 5 * 60 * 1000;

		while (Date.now() < timeoutAt) {
			const probe = await readResponseProbe(page);
			const text = probe.text;
			if (text.length >= substantiveTextThreshold) {
				seenOutput = true;
			}
			if (probe.started && !seenRelevantMutation) {
				seenRelevantMutation = true;
				logger.log(`[${provider}] waiting for response...`);
			}

			if (text !== lastText) {
				lastText = text;
				lastTextChangeAt = Date.now();
			}

			if (
				!probe.started &&
				Date.now() - waitStartedAt >= noOutputTimeoutMs
			) {
				throw new ExternalServiceError(
					provider,
					`No response detected after ${Math.round(noOutputTimeoutMs / 1000)}s`,
				);
			}

			if (!probe.started || !seenOutput) {
				await page.waitForTimeout(pollIntervalMs);
				continue;
			}

			const textStableFor = Date.now() - lastTextChangeAt;
			const quietForMs = probe.quietForMs ?? 0;

			if (
				quietForMs >= RESPONSE_QUIESCENCE_MS &&
				textStableFor >= RESPONSE_QUIESCENCE_MS
			) {
				logger.log(`[${provider}] response ready`);
				return;
			}

			if (
				textStableFor >= forceExitStableMs &&
				quietForMs >= Math.min(RESPONSE_QUIESCENCE_MS, 750)
			) {
				logger.warn(
					`[${provider}] response text stable for ${Math.round(forceExitStableMs / 1000)}s — forcing completion`,
				);
				logger.log(`[${provider}] response ready`);
				return;
			}

			await page.waitForTimeout(pollIntervalMs);
		}

		throw new ExternalServiceError(provider, "Assistant wait timed out");
	} finally {
		await disposeResponseMonitor(page);
	}
}
