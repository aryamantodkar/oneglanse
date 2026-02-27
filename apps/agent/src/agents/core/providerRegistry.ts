import type { Source } from "@oneglanse/types";
import type { Provider } from "@oneglanse/types";
import type { Locator, Page } from "playwright";
import { extractSourcesFromOpenai } from "../chatgpt/lib/extractSources.js";
import { extractSourcesFromPerplexity } from "../perplexity/lib/extractSources.js";
import { navigateWithRetry } from "../../lib/browser/navigate.js";
import { findSourcesButton } from "../../lib/input/sources/findButton.js";
import { logger } from "../../lib/utils/logger.js";
import { extractSourcesFromGemini } from "../gemini/lib/extractSources.js";
import { extractAIOverviewSources } from "../google/ai-overview/lib/extractSources.js";

interface AgentProviderConfig {
	url: string;
	warmupDelayMs: number;
	label: string;
	displayName: string;
	skip?: boolean;
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

export const AGENT_PROVIDER_CONFIG: Record<Provider, AgentProviderConfig> = {
	google: {
		url: "https://gemini.google.com/",
		warmupDelayMs: 5000,
		label: "Google",
		displayName: "Gemini",
		extractSources: async (page) => {
			const btn = await findSourcesButton(page);
			if (!btn) return [];
			await openSourcesPanel(page, btn);
			
			return extractSourcesFromGemini(page, btn);
		},
	},
	openai: {
		url: "https://chatgpt.com/",
		warmupDelayMs: 5000,
		label: "OpenAI",
		displayName: "ChatGPT",
		extractSources: async (page) => {
			const btn = await findSourcesButton(page);
			if (!btn) return [];
			await openSourcesPanel(page, btn);

			return extractSourcesFromOpenai(page, btn);
		},
	},
	perplexity: {
		url: "https://www.perplexity.ai/",
		warmupDelayMs: 5000,
		label: "Perplexity",
		displayName: "Perplexity",
		postNavigationHook: async (page) => {
			const randomDelay = 2000 + Math.floor(Math.random() * 3000);
			await page.waitForTimeout(randomDelay);
			await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
		},
		extractSources: async (page) => {
			const btn = await findSourcesButton(page);
			if (!btn) return [];
			await openSourcesPanel(page, btn);

			return extractSourcesFromPerplexity(page);
		},
	},
	anthropic: {
		url: "https://claude.ai/new",
		warmupDelayMs: 5000,
		skip: true,
		label: "Anthropic",
		displayName: "Claude",
		extractSources: async (page) => {
			return [];
		},
	},
	"google-ai-overview": {
		url: "https://www.google.com/?hl=en&pws=0",
		warmupDelayMs: 0,
		label: "Google AI Overview",
		displayName: "AI Overview",
		postNavigationHook: async (page) => {
			await page
				.locator(
					'button:has-text("Accept all"), button#L2AGLb, [jsname="b3VHJd"]',
				)
				.first()
				.click({ timeout: 3000 })
				.catch(() => null);
		},
		extractSources: (page) => extractAIOverviewSources(page),
	},
};
