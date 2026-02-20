import type { Page } from "playwright";
import type { Provider } from "@onescope/types";
import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { setupPage } from "../../lib/browser/setupPage.js";
import { logger } from "../../lib/utils/logger.js";

interface AgentConfig {
	entryUrl: string;
	warmupDelay: number;
	preNavigate?: (page: Page) => Promise<void>;
	postNavigate?: (page: Page) => Promise<void>;
}

const AGENT_CONFIGS: Record<Provider, AgentConfig> = {
	openai: {
		entryUrl: "https://chatgpt.com/auth/login",
		warmupDelay: 5000,
	},
	anthropic: {
		entryUrl: "https://claude.ai/new",
		warmupDelay: 5000,
	},
	perplexity: {
		entryUrl: "https://www.perplexity.ai",
		warmupDelay: 5000,
		postNavigate: async (page: Page) => {
			// Human-like random delays to avoid bot detection
			const randomDelay = 2000 + Math.floor(Math.random() * 3000);
			await page.waitForTimeout(randomDelay);
			await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
		},
	},
	google: {
		entryUrl: "https://gemini.google.com/",
		warmupDelay: 5000,
	},
	"google-ai-overview": {
		entryUrl: "https://www.google.com",
		warmupDelay: 5000,
		preNavigate: async (page: Page) => {
			logger.log("📍 Activating session via https://gemini.google.com/");
			await navigateWithRetry(page, "https://gemini.google.com/", {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});
			await page.waitForTimeout(1500);
		},
	},
};

export async function createAgent(provider: Provider) {
	const config = AGENT_CONFIGS[provider];

	const { browser, context, proxy } = await launchContext(provider);
	const page = await context.newPage();

	if (config.preNavigate) {
		await config.preNavigate(page);
	}

	logger.log(`📍 Navigating to ${config.entryUrl}`);
	await navigateWithRetry(page, config.entryUrl, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	});

	if (config.postNavigate) {
		await config.postNavigate(page);
	}

	logger.log("Loaded url:", page.url());

	setupPage(page, provider);
	await page.waitForTimeout(config.warmupDelay);

	const auth = await isAuthenticated(page, provider);

	return { browser, context, page, auth, proxy };
}
