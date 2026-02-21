import type { Source } from "@onescope/types";
import type { Provider } from "@onescope/types";
import type { Locator, Page } from "playwright";
import { extractSourcesFromAnthropic } from "../claude/lib/extractSources.js";
import { extractSourcesFromOpenai } from "../chatgpt/lib/extractSources.js";
import { extractSourcesFromPerplexity } from "../perplexity/lib/extractSources.js";
import { extractSourcesFromGoogle } from "../google/gemini/lib/extractSources.js";
import { extractAIOverviewSources } from "../google/ai-overview/lib/extractSources.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { findSourcesButton } from "../../lib/input/findSourcesButton.js";
import { logger } from "../../lib/utils/logger.js";

export interface ProviderConfig {
	entryUrl: string;
	warmupDelayMs: number;
	preNavigationHook?: (page: Page) => Promise<void>;
	postNavigationHook?: (page: Page) => Promise<void>;
	extractSources: (page: Page) => Promise<Source[]>;
}

// Clicks the sources button to open the panel, then waits for it to animate in.
// Used by providers whose sources live behind a UI toggle (openai, perplexity).
async function openSourcesPanel(page: Page, btn: Locator): Promise<void> {
	const handle = await btn.elementHandle();
	if (!handle) return;
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
}

export const AGENT_PROVIDER_CONFIG: Record<Provider, ProviderConfig> = {
	openai: {
		entryUrl: "https://chatgpt.com/auth/login",
		warmupDelayMs: 5000,
		extractSources: async (page) => {
			const btn = await findSourcesButton(page);
			if (!btn) return [];
			await openSourcesPanel(page, btn);
			// extractSourcesFromOpenai extracts sources then clicks btn again to close
			return extractSourcesFromOpenai(page, btn);
		},
	},

	anthropic: {
		entryUrl: "https://claude.ai/new",
		warmupDelayMs: 5000,
		extractSources: (page) => extractSourcesFromAnthropic(page),
	},

	perplexity: {
		entryUrl: "https://www.perplexity.ai",
		warmupDelayMs: 5000,
		postNavigationHook: async (page) => {
			// Human-like random delays to avoid bot detection
			const randomDelay = 2000 + Math.floor(Math.random() * 3000);
			await page.waitForTimeout(randomDelay);
			await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
		},
		extractSources: async (page) => {
			const btn = await findSourcesButton(page);
			if (!btn) return [];
			await openSourcesPanel(page, btn);
			// extractSourcesFromPerplexity closes the panel via Escape internally
			return extractSourcesFromPerplexity(page);
		},
	},

	google: {
		entryUrl: "https://gemini.google.com/",
		warmupDelayMs: 5000,
		extractSources: (page) => extractSourcesFromGoogle(page),
	},

	"google-ai-overview": {
		entryUrl: "https://www.google.com",
		warmupDelayMs: 5000,
		preNavigationHook: async (page) => {
			logger.log("📍 Activating session via https://gemini.google.com/");
			await navigateWithRetry(page, "https://gemini.google.com/", {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});
			await page.waitForTimeout(1500);
		},
		extractSources: (page) => extractAIOverviewSources(page),
	},
};
