import {
	BaseError,
	ExternalServiceError,
	toErrorMessage,
} from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { logger, withTimeout } from "@oneglanse/utils";
import type { Browser, BrowserContext, ConsoleMessage, Page } from "playwright";
import { env } from "../env.js";
import { launchContext } from "../lib/browser/launch.js";
import { navigateWithRetry } from "../lib/browser/navigate.js";
import { PROVIDER_CONFIGS } from "./providers/index.js";

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

const DEFAULT_PAGE_TIMEOUT_MS = env.PAGE_DEFAULT_TIMEOUT_MS;
const DEFAULT_NAV_TIMEOUT_MS = env.PAGE_DEFAULT_NAVIGATION_TIMEOUT_MS;
const HOOK_TIMEOUT_MS = env.PROVIDER_HOOK_TIMEOUT_MS;

export async function createAgent(provider: Provider): Promise<{
	browser: Browser;
	context: BrowserContext;
	page: Page;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	const config = PROVIDER_CONFIGS[provider];

	const { browser, context, profile, proxy, cleanup } =
		await launchContext(provider);
	let phase = "new_page";

	try {
		const page = await context.newPage();
		await page.setViewportSize(profile.viewport);

		if (env.BROWSER_TIMEZONE) {
			const client = await page.context().newCDPSession(page);
			try {
				await client.send("Emulation.setTimezoneOverride", {
					timezoneId: env.BROWSER_TIMEZONE,
				});
			} finally {
				await client.detach().catch(() => null);
			}
		}

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

/**
 * Opens a new page on an existing browser context, navigates it to the
 * provider's URL, and runs all the same hooks/timeouts as createAgent.
 * Used by the chain runner to add providers to an already-running browser.
 * The returned cleanup only closes the page — context and browser are managed
 * by the caller.
 */
export async function setupProviderPage(
	context: BrowserContext,
	provider: Provider,
): Promise<{ page: Page; cleanup: () => Promise<void> }> {
	const config = PROVIDER_CONFIGS[provider];
	let phase = "new_page";
	const page = await context.newPage();

	try {
		await page.setViewportSize(DEFAULT_VIEWPORT);

		if (env.BROWSER_TIMEZONE) {
			const client = await page.context().newCDPSession(page);
			try {
				await client.send("Emulation.setTimezoneOverride", {
					timezoneId: env.BROWSER_TIMEZONE,
				});
			} finally {
				await client.detach().catch(() => null);
			}
		}

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

		page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MS);
		page.setDefaultNavigationTimeout(DEFAULT_NAV_TIMEOUT_MS);

		phase = "warmup_delay";
		await page.waitForTimeout(config.warmupDelayMs);

		return { page, cleanup: async () => { await page.close().catch(() => {}); } };
	} catch (err) {
		await page.close().catch(() => {});
		if (err instanceof BaseError) {
			throw err;
		}
		throw new ExternalServiceError(
			provider,
			`setupProviderPage failed during ${phase}: ${toErrorMessage(err)}`,
			502,
			{ phase, provider, url: config.url },
			err,
		);
	}
}
