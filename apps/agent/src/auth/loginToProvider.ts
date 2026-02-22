import fs from "node:fs";
import path from "node:path";
import type { Provider } from "@onescope/types";
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import { AGENT_PROVIDER_CONFIG } from "../agents/core/providerRegistry.js";
import { logger } from "../lib/utils/logger.js";
import { LOCAL_AUTH_BROWSER_PROFILE_PATH, USER_DATA_DIR } from "./config.js";

interface LoginToProviderOptions {
	loginContext?: BrowserContext;
	loginPage?: Page;
	skipCountdown?: boolean;
}

const chooserAttachedPages = new WeakSet<Page>();
const chooserAttachedContexts = new WeakSet<BrowserContext>();

function buildGoogleOAuthSelectAccountUrl(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		if (url.hostname !== "accounts.google.com") return null;

		let changed = false;
		const path = url.pathname.toLowerCase();
		const looksOAuthEndpoint =
			path.includes("oauth") ||
			path.includes("/o/oauth2/") ||
			path.includes("/signin/") ||
			path.includes("/accountchooser");
		const hasOAuthishParams =
			url.searchParams.has("client_id") || url.searchParams.has("redirect_uri");

		const ensurePromptOn = (target: URL): boolean => {
			const current = target.searchParams.get("prompt");
			if (!current) {
				target.searchParams.set("prompt", "select_account");
				return true;
			}

			const parts = current
				.split(" ")
				.map((p) => p.trim())
				.filter(Boolean);
			if (parts.includes("select_account")) return false;

			target.searchParams.set("prompt", `${current} select_account`.trim());
			return true;
		};

		if (looksOAuthEndpoint || hasOAuthishParams) {
			changed = ensurePromptOn(url) || changed;
		}

		const cont = url.searchParams.get("continue");
		if (cont) {
			try {
				const continueUrl = new URL(cont);
				const continuePath = continueUrl.pathname.toLowerCase();
				const continueLooksOAuth =
					continuePath.includes("oauth") ||
					continueUrl.searchParams.has("client_id") ||
					continueUrl.searchParams.has("redirect_uri");

				if (continueLooksOAuth && ensurePromptOn(continueUrl)) {
					url.searchParams.set("continue", continueUrl.toString());
					changed = true;
				}
			} catch {
				// Ignore malformed continue URL
			}
		}

		return changed ? url.toString() : null;
	} catch {
		return null;
	}
}

function enforceGoogleAccountChooser(page: Page): void {
	if (chooserAttachedPages.has(page)) return;
	chooserAttachedPages.add(page);

	let rewriteInFlight = false;
	let lastRewrite = "";

	page.on("framenavigated", (frame) => {
		if (frame !== page.mainFrame()) return;
		if (rewriteInFlight) return;

		const target = buildGoogleOAuthSelectAccountUrl(frame.url());
		if (!target || target === lastRewrite) return;

		rewriteInFlight = true;
		lastRewrite = target;

		void page
			.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 })
			.catch(() => {})
			.finally(() => {
				rewriteInFlight = false;
			});
	});
}

function enforceGoogleAccountChooserForContext(context: BrowserContext): void {
	if (chooserAttachedContexts.has(context)) return;
	chooserAttachedContexts.add(context);

	for (const page of context.pages()) {
		enforceGoogleAccountChooser(page);
	}

	context.on("page", (page) => {
		enforceGoogleAccountChooser(page);
	});
}

function waitForEnter(message: string): Promise<void> {
	return new Promise((resolve) => {
		process.stdout.write(message);
		process.stdin.resume();
		const onData = () => {
			process.stdin.removeListener("data", onData);
			process.stdin.pause();
			resolve();
		};
		process.stdin.on("data", onData);
	});
}

export async function loginToProvider(
	provider: Provider,
	options: LoginToProviderOptions = {},
): Promise<void> {
	const config = AGENT_PROVIDER_CONFIG[provider];
	const providerDir = path.join(USER_DATA_DIR, provider);
	const authFile = path.join(providerDir, `${provider}-auth.json`);

	if (!fs.existsSync(providerDir)) {
		fs.mkdirSync(providerDir, { recursive: true });
	}
	if (!fs.existsSync(LOCAL_AUTH_BROWSER_PROFILE_PATH)) {
		fs.mkdirSync(LOCAL_AUTH_BROWSER_PROFILE_PATH, { recursive: true });
	}

	// Show clear instructions before browser launch
	logger.log(`\n${"=".repeat(70)}`);
	logger.log(`🔐 ${provider.toUpperCase()} AUTHENTICATION`);
	logger.log(`${"=".repeat(70)}\n`);

	logger.log("📋 Instructions:");
	logger.log(
		options.skipCountdown
			? "   1. A browser window is opening now"
			: "   1. A browser window will open in 3 seconds",
	);
	logger.log(`   2. Please log in to ${provider} in the browser`);
	logger.log(
		options.loginContext
			? "   3. Browser will stay open for the next provider"
			: "   3. The browser will close automatically once logged in",
	);
	logger.log("   4. Timeout: 8 minutes\n");

	const createdContext = !options.loginContext;

	if (!options.skipCountdown) {
		logger.warn("⏰ Preparing to open browser...");

		// Countdown before launch
		for (let i = 3; i > 0; i--) {
			process.stdout.write(`\r   Opening in ${i} seconds...`);
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		process.stdout.write("\r   Opening browser now!     \n\n");
	}

	const loginContext =
		options.loginContext ??
		(await chromium.launchPersistentContext(LOCAL_AUTH_BROWSER_PROFILE_PATH, {
			headless: false,
			args: [
				"--disable-blink-features=AutomationControlled",
				"--no-sandbox",
				"--disable-setuid-sandbox",
			],
			viewport: null,
		}));
	enforceGoogleAccountChooserForContext(loginContext);

	try {
		let loginPage = options.loginPage;
		if (!loginPage) {
			loginPage = await loginContext.newPage();
		}
		enforceGoogleAccountChooser(loginPage);

		logger.log(
			"✅ Browser opened - Please complete login in the browser window",
		);
		logger.log(
			"🛑 Auto auth detection is disabled. Switch accounts if needed, then press Enter here to save this session.\n",
		);

		await loginPage.goto(config.url, {
			waitUntil: "domcontentloaded",
		});

		await waitForEnter("Press Enter after login/account switching is complete...");

		if (provider === "google" || provider === "google-ai-overview") {
			logger.log("🔄 Visiting google.com to capture full session cookies...");
			await loginPage
				.goto("https://www.google.com", {
					waitUntil: "domcontentloaded",
					timeout: 30000,
				})
				.catch(() => {});
			await loginPage.waitForTimeout(2000);
		}

		await loginContext.storageState({
			path: authFile,
		});

		logger.success(`✅ ${provider} authentication successful!`);
		logger.log(`📁 Session saved to: ${authFile}\n`);
	} catch (err) {
		logger.error(`Failed to login to ${provider}:`, err);
		throw err;
	} finally {
		if (createdContext) {
			await loginContext.close();
		}
	}
}
