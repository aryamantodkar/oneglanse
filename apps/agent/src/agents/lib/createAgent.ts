import type { Page } from "playwright";
import type { Provider } from "@onescope/types";
import { PROVIDERS } from "@onescope/utils";
import { isAuthenticated } from "../../lib/auth/isAuthenticated.js";
import { launchContext } from "../../lib/browser/launchContext.js";
import { navigateWithRetry } from "../../lib/browser/navigateWithRetry.js";
import { logger } from "../../lib/utils/logger.js";

interface AgentHooks {
	preNavigate?: (page: Page) => Promise<void>;
	postNavigate?: (page: Page) => Promise<void>;
}

const AGENT_HOOKS: Partial<Record<Provider, AgentHooks>> = {
	perplexity: {
		postNavigate: async (page: Page) => {
			// Human-like random delays to avoid bot detection
			const randomDelay = 2000 + Math.floor(Math.random() * 3000);
			await page.waitForTimeout(randomDelay);
			await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
		},
	},
	"google-ai-overview": {
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
	const hooks = AGENT_HOOKS[provider];
	const providerConfig = PROVIDERS[provider];

	const { browser, context, proxy } = await launchContext(provider);
	const page = await context.newPage();

	if (hooks?.preNavigate) {
		await hooks.preNavigate(page);
	}

	logger.log(`📍 Navigating to ${providerConfig.entryUrl}`);
	await navigateWithRetry(page, providerConfig.entryUrl, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	});

	if (hooks?.postNavigate) {
		await hooks.postNavigate(page);
	}

	logger.log("Loaded url:", page.url());

	page.setDefaultTimeout(0);
	page.setDefaultNavigationTimeout(0);

	page.on("console", (msg) => {
		// console.log(`[${provider.toUpperCase()} PAGE]`, msg.text())
	});

	await page.waitForTimeout(providerConfig.warmupDelay);

	const auth = await isAuthenticated(page, provider);

	return { browser, context, page, auth, proxy };
}
