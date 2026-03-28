import {
	BaseError,
	ExternalServiceError,
	toErrorMessage,
} from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, withTimeout } from "@oneglanse/utils";
import type { Browser, BrowserContext, ConsoleMessage, Page } from "playwright";
import { env } from "../env.js";
import {
	type LaunchContextOptions,
	launchContext,
} from "../lib/browser/launch.js";
import { navigateWithRetry } from "../lib/browser/navigate.js";
import { PROVIDER_CONFIGS } from "./providers/index.js";

const DEFAULT_PAGE_TIMEOUT_MS = env.PAGE_DEFAULT_TIMEOUT_MS;
const DEFAULT_NAV_TIMEOUT_MS = env.PAGE_DEFAULT_NAVIGATION_TIMEOUT_MS;
const HOOK_TIMEOUT_MS = env.PROVIDER_HOOK_TIMEOUT_MS;

export async function createAgent(
	provider: Provider,
	options?: LaunchContextOptions,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy: string | null;
	cleanup: () => Promise<void>;
	invalidateProxyHint: () => Promise<void>;
}> {
	const config = PROVIDER_CONFIGS[provider];

	const { browser, context, proxy, cleanup, invalidateProxyHint } = await launchContext(
		provider,
		options,
	);
	let phase = "new_page";

	try {
		const page = await context.newPage();

		if (!config.skipInitialNavigation) {
			if (config.preNavigationHook) {
				const preNavigationHook = config.preNavigationHook;
				phase = "pre_navigation_hook";
				await withTimeout(
					`[${provider}] preNavigationHook`,
					async () => preNavigationHook(page),
					HOOK_TIMEOUT_MS,
				);
			}

			phase = "navigate";
			logger.log(`navigating to ${config.url}`);
			await navigateWithRetry(page, config.url, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			if (config.postNavigationHook) {
				const postNavigationHook = config.postNavigationHook;
				phase = "post_navigation_hook";
				await withTimeout(
					`[${provider}] postNavigationHook`,
					async () => postNavigationHook(page),
					HOOK_TIMEOUT_MS,
				);
			}

			logger.log(`page ready: ${page.url()}`);

			phase = "warmup_delay";
			await page.waitForTimeout(config.warmupDelayMs);
		}

		// Keep finite defaults to prevent indefinite hangs in locator/actions.
		// Long-running response generation is handled separately via explicit waits.
		page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);
		page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);

		page.on("console", (_msg: ConsoleMessage) => {
			// console.log(`[${provider.toUpperCase()} PAGE]`, _msg.text())
		});

		return { browser, context, page, proxy, cleanup, invalidateProxyHint };
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
