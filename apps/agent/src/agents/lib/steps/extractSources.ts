import type { Provider, Source } from "@onescope/types";
import { SOURCES_SELECTORS } from "@onescope/utils";
import type { Locator, Page } from "playwright";
import { findLastAssistantBox } from "../../../lib/input/findAssistantElement.js";
import { logger } from "../../../lib/utils/logger.js";
import { extractSourcesFromOpenai } from "../../chatgpt/lib/extractSources.js";
import { extractSourcesFromAnthropic } from "../../claude/lib/extractSources.js";
import { extractAIOverviewSources } from "../../google/ai-overview/lib/extractSources.js";
import { extractSourcesFromGoogle } from "../../google/gemini/lib/extractSources.js";
import { extractSourcesFromPerplexity } from "../../perplexity/lib/extractSources.js";

export async function checkAndExtractSources(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	let sources: Source[] = [];

	try {
		sources = await extractSourcesFromPanel(page, provider);
	} catch (err) {
		logger.warn("Failed to extract sources, continuing:", err);
		sources = [];
	}

	return sources;
}

export async function findSourcesButton(page: Page): Promise<Locator | null> {
	const assistantBox = await findLastAssistantBox(page);
	if (!assistantBox) return null;

	let sourcesButton: Locator | null = null;
	let minDistance = Number.POSITIVE_INFINITY;

	for (const selector of SOURCES_SELECTORS) {
		const buttons = page.locator(selector);
		const count = await buttons.count();

		for (let i = 0; i < count; i++) {
			const btn = buttons.nth(i);

			if (!(await btn.isVisible().catch(() => false))) continue;

			const box = await btn.boundingBox();
			if (!box) continue;

			// Must be visually below assistant message
			const deltaY = box.y - (assistantBox.y + assistantBox.height);
			if (deltaY < -8) continue;

			if (deltaY < minDistance) {
				minDistance = deltaY;
				sourcesButton = btn;
			}
		}
	}

	return sourcesButton;
}

export async function extractSourcesFromPanel(
	page: Page,
	provider: Provider,
): Promise<Source[]> {
	logger.debug("🔍 Opening sources panel (latest response only)...");

	await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(1000);

	// Anthropic does not have sources tab.
	if (provider === "anthropic") {
		return await extractSourcesFromAnthropic(page);
	}

	// Google AI Overview has custom extraction
	if (provider === "google-ai-overview") {
		return await extractAIOverviewSources(page);
	}

	// Google/Gemini has custom extraction
	if (provider === "google") {
		return await extractSourcesFromGoogle(page);
	}

	const sourcesButton = await findSourcesButton(page);
	let sources: Source[] = [];

	if (!sourcesButton) {
		logger.debug("ℹ️  No sources button for latest response");
		return [];
	}

	logger.debug("→ Clicking sources button");
	const handle = await sourcesButton.elementHandle();
	if (!handle) return [];

	await page.evaluate((el) => {
		if (el instanceof HTMLElement) {
			el.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					composed: true,
					view: window,
				}),
			);
		}
	}, handle);

	await page.waitForTimeout(1000);

	if (provider === "openai") {
		sources = await extractSourcesFromOpenai(page, sourcesButton);
	} else if (provider === "perplexity") {
		sources = await extractSourcesFromPerplexity(page);
	}

	logger.debug(`✅ Extracted ${sources.length} sources`);

	await page.waitForTimeout(1000);

	return sources;
}
