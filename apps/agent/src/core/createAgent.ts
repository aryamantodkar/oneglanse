import { BaseError, ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import type { Browser, BrowserContext, ConsoleMessage, Page } from "playwright";
import { env } from "../env.js";
import { launchContext } from "../lib/browser/launch.js";
import { navigateWithRetry } from "../lib/browser/navigate.js";
import { withNavigationThrottle } from "../lib/browser/trafficShaping.js";
import { logger, withTimeout } from "@oneglanse/utils";
import { PROVIDER_CONFIGS } from "./providers/index.js";

const DEFAULT_PAGE_TIMEOUT_MS = env.PAGE_DEFAULT_TIMEOUT_MS;
const DEFAULT_NAV_TIMEOUT_MS = env.PAGE_DEFAULT_NAVIGATION_TIMEOUT_MS;
const HOOK_TIMEOUT_MS = env.PROVIDER_HOOK_TIMEOUT_MS;

export async function createAgent(
	provider: Provider,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	const config = PROVIDER_CONFIGS[provider];

	const { browser, context, proxy, cleanup } = await launchContext(provider);
	let phase = "new_page";

	try {
		const page = await context.newPage();

		if (config.preNavigationHook) {
			phase = "pre_navigation_hook";
			await withTimeout(
				`[${provider}] preNavigationHook`,
				async () => config.preNavigationHook!(page),
				HOOK_TIMEOUT_MS,
			);
		}

		phase = "navigate";
		await withNavigationThrottle(provider, async () => {
			logger.log(`navigating to ${config.url}`);
			await navigateWithRetry(page, config.url, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});
		});

		if (config.postNavigationHook) {
			phase = "post_navigation_hook";
			await withTimeout(
				`[${provider}] postNavigationHook`,
				async () => config.postNavigationHook!(page),
				HOOK_TIMEOUT_MS,
			);
		}

		logger.log(`page ready: ${page.url()}`);

		// Keep finite defaults to prevent indefinite hangs in locator/actions.
		// Long-running response generation is handled separately via explicit waits.
		page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);
		page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);

		page.on("console", (_msg: ConsoleMessage) => {
			// console.log(`[${provider.toUpperCase()} PAGE]`, _msg.text())
		});

		phase = "warmup_delay";
		await page.waitForTimeout(config.warmupDelayMs);

		return { browser, context, page, proxy, cleanup };
	} catch (err) {
		await cleanup();
		if (err instanceof BaseError) {
			throw err;
		}
		throw new ExternalServiceError(
			provider,
			`createAgent failed during ${phase}: ${toErrorMessage(err)}`,
			502,
			{
				phase,
				provider,
				url: config.url,
				proxy,
			},
			err,
		);
	}
}
