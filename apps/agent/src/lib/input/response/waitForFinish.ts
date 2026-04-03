import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import {
	PROVIDER_FORCE_EXIT_STABLE_MS,
	PROVIDER_NO_OUTPUT_TIMEOUT_MS,
	logger,
} from "@oneglanse/utils";
import type { Page } from "playwright";
import {
	invalidateSelectorProfileForPage,
	waitForSelectorProfile,
} from "../../selectors/intelligence.js";
import { getText } from "./getText.js";
import { isGenerating } from "./isGenerating.js";

export async function waitForAssistantToFinish(
	page: Page,
	provider: Provider,
): Promise<void> {
	logger.debug("⏳ Waiting for assistant to finish…");

	let lastText = "";
	let lastChange = Date.now();
	let seenOutput = false;
	let seenGenerating = false;
	let textGrowthEvents = 0;
	let responseSelectorsReady = false;
	let selectorResolutionError: ExternalServiceError | null = null;
	let waitStart: number | null = null;

	const noOutputTimeoutMs = PROVIDER_NO_OUTPUT_TIMEOUT_MS[provider];
	const forceExitStableMs = PROVIDER_FORCE_EXIT_STABLE_MS[provider];

	void waitForSelectorProfile(page, provider, "response", noOutputTimeoutMs)
		.then(() => {
			responseSelectorsReady = true;
			waitStart = Date.now();
			logger.log(`[${provider}] waiting for response...`);
		})
		.catch((err) => {
			selectorResolutionError = new ExternalServiceError(
				provider,
				`Response selector resolution failed: ${toErrorMessage(err)}`,
			);
		});

	try {
		const pollIntervalMs = 280 + Math.floor(Math.random() * 60);
		const timeoutAt = Date.now() + 5 * 60 * 1000;

		while (Date.now() < timeoutAt) {
			if (selectorResolutionError) {
				throw selectorResolutionError;
			}

			if (!responseSelectorsReady) {
				await page.waitForTimeout(pollIntervalMs);
				continue;
			}

			const [generating, text] = await Promise.all([
				isGenerating(page, provider),
				getText(page, provider),
			]);

			if (generating) {
				seenGenerating = true;
			}

			if (text.length >= 20) {
				seenOutput = true;
			}

			if (text !== lastText) {
				if (text.length > lastText.length) {
					textGrowthEvents += 1;
				}
				lastText = text;
				lastChange = Date.now();
			}

			const stableFor = Date.now() - lastChange;
			const noOutputFor = waitStart !== null ? Date.now() - waitStart : 0;

			if (
				waitStart !== null &&
				!seenOutput &&
				noOutputFor >= noOutputTimeoutMs
			) {
				throw new ExternalServiceError(
					provider,
					`No response detected after ${Math.round(noOutputTimeoutMs / 1000)}s`,
				);
			}

			if (generating && !seenOutput) {
				await page.waitForTimeout(pollIntervalMs);
				continue;
			}

			if (seenOutput && !generating) {
				const requiredStableMs = seenGenerating
					? 1500
					: textGrowthEvents >= 4 || text.length >= 1000
						? 3000
						: 4500;
				const enoughGrowthWithoutIndicator =
					seenGenerating || textGrowthEvents >= 2 || text.length >= 300;
				if (enoughGrowthWithoutIndicator && stableFor >= requiredStableMs) {
					logger.log(`[${provider}] response ready`);
					return;
				}
			}

			const staleGeneratingThreshold = Math.min(forceExitStableMs, 12_000);
			if (seenOutput && generating && stableFor >= staleGeneratingThreshold) {
				logger.warn(
					`[${provider}] text stable ${Math.round(staleGeneratingThreshold / 1000)}s but still generating — forcing exit`,
				);
				logger.log(`[${provider}] response ready`);
				return;
			}

			await page.waitForTimeout(pollIntervalMs);
		}

		throw new ExternalServiceError(provider, "Assistant wait timed out");
	} catch (error) {
		await invalidateSelectorProfileForPage(page, provider, "response").catch(
			() => null,
		);
		throw error;
	}
}
