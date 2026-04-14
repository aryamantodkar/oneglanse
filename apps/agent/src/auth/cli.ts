import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	ensureAuthDirectories,
	getReusableIdentityDomainSuffixes,
	readAuthLaunchSeedState,
	saveAuthSession,
	saveReusableIdentitySessions,
	uploadAuthSession,
	writeProviderAuthStatus,
} from "@oneglanse/services";
import { AUTH_PROVIDER_LIST, type AuthProvider } from "@oneglanse/types";
import {
	AUTH_PROVIDER_CONFIG,
	AUTH_PROVIDER_DISPLAY,
	getProviderDisplayName,
	logger,
} from "@oneglanse/utils";
import {
	type BrowserContext,
	type Frame,
	type Page,
	type Response,
	firefox,
} from "playwright-core";
import { resolveCamoufoxLaunchOptions } from "../lib/browser/camoufox.js";
import { detectDisplay } from "../lib/browser/display.js";

const AUTH_SNAPSHOT_DEBOUNCE_MS = 250;
const AUTH_SNAPSHOT_HEARTBEAT_MS = 2_000;
const AUTH_WINDOW_CLOSE_GRACE_MS = 1_000;
const SYSTEM_THEME_DETECT_TIMEOUT_MS = 4_000;
const execFileAsync = promisify(execFile);
type BrowserLaunchOptions = NonNullable<Parameters<typeof firefox.launch>[0]>;
type PersistedStorageState = Parameters<typeof saveAuthSession>[1];
type PersistedCookie = NonNullable<PersistedStorageState["cookies"]>[number];
type SnapshotOrigin = {
	origin: string;
	localStorage: Array<{ name: string; value: string }>;
};

function dedupeStrings(values: readonly string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseProviderArg(argv: string[]): AuthProvider {
	const providerFlagIndex = argv.findIndex((value) => value === "--provider");
	const providerValue =
		providerFlagIndex >= 0 ? argv[providerFlagIndex + 1]?.trim() : undefined;

	if (
		!providerValue ||
		!AUTH_PROVIDER_LIST.includes(providerValue as AuthProvider)
	) {
		throw new Error(
			`--provider must be one of: ${AUTH_PROVIDER_LIST.join(", ")}`,
		);
	}

	return providerValue as AuthProvider;
}

function attachAuthDebugLogging(
	context: BrowserContext,
	provider: AuthProvider,
): void {
	const seenPages = new WeakSet<Page>();

	const watchPage = (page: Page, source: "existing" | "new" | "popup") => {
		if (seenPages.has(page)) {
			return;
		}
		seenPages.add(page);

		const pageId = Math.random().toString(36).slice(2, 8);
		logger.debug(
			`[auth:${provider}] page opened source=${source} id=${pageId} initialUrl=${page.url() || "about:blank"}`,
		);

		page.on("framenavigated", (frame) => {
			if (frame !== page.mainFrame()) return;
			logger.debug(
				`[auth:${provider}] page navigated id=${pageId} url=${frame.url()}`,
			);
		});

		page.on("popup", (popup) => {
			logger.debug(
				`[auth:${provider}] popup opened parent=${pageId} initialUrl=${popup.url() || "about:blank"}`,
			);
			watchPage(popup, "popup");
		});

		page.on("close", () => {
			logger.debug(`[auth:${provider}] page closed id=${pageId}`);
		});

		void page
			.title()
			.then((title) => {
				logger.debug(
					`[auth:${provider}] page title id=${pageId} title=${title || "<empty>"}`,
				);
			})
			.catch(() => {});
	};

	for (const page of context.pages()) {
		watchPage(page, "existing");
	}

	context.on("page", (page) => {
		watchPage(page, "new");
	});
}

async function detectSystemDarkMode(): Promise<boolean | null> {
	try {
		if (process.platform === "darwin") {
			await execFileAsync("defaults", ["read", "-g", "AppleInterfaceStyle"], {
				timeout: SYSTEM_THEME_DETECT_TIMEOUT_MS,
			});
			return true;
		}

		if (process.platform === "win32") {
			const { stdout } = await execFileAsync(
				"powershell",
				[
					"-NoProfile",
					"-Command",
					"(Get-ItemPropertyValue -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name AppsUseLightTheme) -eq 0",
				],
				{
					encoding: "utf8",
					timeout: SYSTEM_THEME_DETECT_TIMEOUT_MS,
				},
			);
			const normalized = stdout.trim().toLowerCase();
			if (normalized === "true") return true;
			if (normalized === "false") return false;
			return null;
		}

		const { stdout } = await execFileAsync(
			"gsettings",
			["get", "org.gnome.desktop.interface", "color-scheme"],
			{
				encoding: "utf8",
				timeout: SYSTEM_THEME_DETECT_TIMEOUT_MS,
			},
		);
		const normalized = stdout.trim().toLowerCase();
		if (normalized.includes("prefer-dark")) return true;
		if (normalized.includes("default") || normalized.includes("prefer-light")) {
			return false;
		}
		return null;
	} catch {
		return null;
	}
}

function matchesDomainSuffix(
	hostOrDomain: string,
	suffixes: readonly string[],
): boolean {
	const normalized = hostOrDomain.replace(/^\./, "").toLowerCase();
	return suffixes.some(
		(suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
	);
}

function normalizeOrigin(url: string): string | null {
	try {
		const origin = new URL(url).origin;
		return origin === "null" ? null : origin;
	} catch {
		return null;
	}
}

function isTrackedUrl(url: string, suffixes: readonly string[]): boolean {
	const origin = normalizeOrigin(url);
	if (!origin) return false;

	try {
		return matchesDomainSuffix(new URL(origin).hostname, suffixes);
	} catch {
		return false;
	}
}

function cloneCookies(
	cookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
): PersistedCookie[] {
	return cookies.map(
		({ name, value, domain, path, expires, httpOnly, secure, sameSite }) => ({
			name,
			value,
			domain,
			path,
			expires,
			httpOnly,
			secure,
			sameSite,
		}),
	);
}

function toPlaywrightStorageState(
	state: PersistedStorageState | null,
):
	| {
			cookies: Array<{
				name: string;
				value: string;
				domain: string;
				path: string;
				expires: number;
				httpOnly: boolean;
				secure: boolean;
				sameSite: "Strict" | "Lax" | "None";
			}>;
			origins: Array<{
				origin: string;
				localStorage: Array<{ name: string; value: string }>;
			}>;
	  }
	| undefined {
	if (!state) {
		return undefined;
	}

	return {
		cookies: (state.cookies ?? [])
			.map((cookie) => {
				const name = cookie.name?.trim();
				const domain = cookie.domain?.trim();
				if (!name || !domain) {
					return null;
				}

				return {
					name,
					value: cookie.value ?? "",
					domain,
					path: cookie.path?.trim() || "/",
					expires:
						typeof cookie.expires === "number" ? cookie.expires : -1,
					httpOnly: Boolean(cookie.httpOnly),
					secure: Boolean(cookie.secure),
					sameSite: cookie.sameSite ?? "Lax",
				};
			})
			.filter(
				(cookie): cookie is NonNullable<typeof cookie> => cookie !== null,
			),
		origins: (state.origins ?? [])
			.map((originEntry) => {
				const origin = originEntry.origin?.trim();
				if (!origin) {
					return null;
				}

				return {
					origin,
					localStorage: (originEntry.localStorage ?? [])
						.map((item) => {
							const name = item.name?.trim();
							if (!name) {
								return null;
							}

							return {
								name,
								value: item.value ?? "",
							};
						})
						.filter((item): item is NonNullable<typeof item> => item !== null),
				};
			})
			.filter(
				(originEntry): originEntry is NonNullable<typeof originEntry> =>
					originEntry !== null,
			),
	};
}

async function collectPageLocalStorage(
	page: Page,
	suffixes: readonly string[],
): Promise<SnapshotOrigin | null> {
	if (page.isClosed() || !isTrackedUrl(page.url(), suffixes)) {
		return null;
	}

	const storage = await page
		.evaluate<SnapshotOrigin | null>(() => {
			try {
				const origin = window.location.origin;
				if (!origin || origin === "null") {
					return null;
				}

				const localStorageItems: Array<{ name: string; value: string }> = [];
				for (let index = 0; index < window.localStorage.length; index += 1) {
					const name = window.localStorage.key(index);
					if (!name) continue;
					localStorageItems.push({
						name,
						value: window.localStorage.getItem(name) ?? "",
					});
				}

				localStorageItems.sort((left, right) =>
					left.name.localeCompare(right.name),
				);

				return {
					origin,
					localStorage: localStorageItems,
				};
			} catch {
				return null;
			}
		})
		.catch(() => null);

	if (!storage || !isTrackedUrl(storage.origin, suffixes)) {
		return null;
	}

	return storage;
}

class AuthSessionTracker {
	private readonly suffixes: readonly string[];
	private readonly disposers: Array<() => void> = [];
	private latestCookies: PersistedCookie[] = [];
	private latestOrigins = new Map<string, SnapshotOrigin>();
	private debounceTimer: NodeJS.Timeout | null = null;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private snapshotInFlight: Promise<void> | null = null;
	private snapshotRequested = false;
	private stopped = false;

	constructor(
		private readonly context: BrowserContext,
		provider: AuthProvider,
	) {
		this.suffixes = dedupeStrings([
			...AUTH_PROVIDER_CONFIG[provider].domainSuffixes,
			...getReusableIdentityDomainSuffixes(),
		]);
	}

	start(): void {
		for (const page of this.context.pages()) {
			this.watchPage(page);
		}

		const handlePage = (page: Page) => {
			this.watchPage(page);
			this.requestSnapshot();
		};
		const handleContextClose = () => {
			this.stopTimers();
			this.stopped = true;
		};

		this.context.on("page", handlePage);
		this.context.on("close", handleContextClose);
		this.disposers.push(() => {
			this.context.off("page", handlePage);
		});
		this.disposers.push(() => {
			this.context.off("close", handleContextClose);
		});

		this.heartbeatTimer = setInterval(() => {
			this.requestSnapshot();
		}, AUTH_SNAPSHOT_HEARTBEAT_MS);

		this.requestSnapshot(true);
	}

	async finish(): Promise<PersistedStorageState | null> {
		this.stopped = true;
		this.stopTimers();
		await this.snapshotInFlight?.catch(() => {});

		for (const dispose of this.disposers.splice(0)) {
			dispose();
		}

		const origins = [...this.latestOrigins.values()].sort((left, right) =>
			left.origin.localeCompare(right.origin),
		);

		if (this.latestCookies.length === 0 && origins.length === 0) {
			return null;
		}

		return {
			cookies: [...this.latestCookies],
			origins,
		};
	}

	private watchPage(page: Page): void {
		const handleMainFrameNavigation = (frame: Frame) => {
			if (frame !== page.mainFrame()) return;
			if (isTrackedUrl(frame.url(), this.suffixes)) {
				this.requestSnapshot();
			}
		};
		const handleDomContentLoaded = () => {
			if (isTrackedUrl(page.url(), this.suffixes)) {
				this.requestSnapshot();
			}
		};
		const handleLoad = () => {
			if (isTrackedUrl(page.url(), this.suffixes)) {
				this.requestSnapshot();
			}
		};
		const handleResponse = (response: Response) => {
			const resourceType = response.request().resourceType();
			if (
				(resourceType === "document" ||
					resourceType === "xhr" ||
					resourceType === "fetch") &&
				isTrackedUrl(response.url(), this.suffixes)
			) {
				this.requestSnapshot();
			}
		};
		const handleClose = () => {
			this.requestSnapshot(true);
		};

		page.on("framenavigated", handleMainFrameNavigation);
		page.on("domcontentloaded", handleDomContentLoaded);
		page.on("load", handleLoad);
		page.on("response", handleResponse);
		page.on("close", handleClose);
		this.disposers.push(() => {
			page.off("framenavigated", handleMainFrameNavigation);
			page.off("domcontentloaded", handleDomContentLoaded);
			page.off("load", handleLoad);
			page.off("response", handleResponse);
			page.off("close", handleClose);
		});
	}

	private requestSnapshot(immediate = false): void {
		if (this.stopped) {
			return;
		}

		this.snapshotRequested = true;
		if (this.snapshotInFlight) {
			return;
		}

		if (immediate) {
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
			}
			void this.flushSnapshotQueue();
			return;
		}

		if (this.debounceTimer) {
			return;
		}

		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = null;
			void this.flushSnapshotQueue();
		}, AUTH_SNAPSHOT_DEBOUNCE_MS);
	}

	private async flushSnapshotQueue(): Promise<void> {
		if (this.stopped || this.snapshotInFlight || !this.snapshotRequested) {
			return;
		}

		this.snapshotRequested = false;
		const run = this.collectSnapshot();
		this.snapshotInFlight = run;

		try {
			await run;
		} finally {
			this.snapshotInFlight = null;
			if (this.snapshotRequested && !this.stopped) {
				this.requestSnapshot();
			}
		}
	}

	private async collectSnapshot(): Promise<void> {
		const cookies = await this.context.cookies().catch(() => null);
		if (cookies) {
			this.latestCookies = cloneCookies(cookies);
		}

		for (const page of this.context.pages()) {
			if (page.isClosed()) {
				continue;
			}

			const originState = await collectPageLocalStorage(page, this.suffixes);
			if (!originState) {
				continue;
			}

			if (originState.localStorage.length === 0) {
				this.latestOrigins.delete(originState.origin);
				continue;
			}

			this.latestOrigins.set(originState.origin, originState);
		}
	}

	private stopTimers(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}
}

async function waitForAllAuthPagesToClose(
	context: BrowserContext,
): Promise<void> {
	const disposers: Array<() => void> = [];
	let closeTimer: NodeJS.Timeout | null = null;

	const clearCloseTimer = () => {
		if (closeTimer) {
			clearTimeout(closeTimer);
			closeTimer = null;
		}
	};

	const getOpenPageCount = () =>
		context.pages().filter((page) => !page.isClosed()).length;

	const waitForStableZeroPages = () =>
		new Promise<void>((resolve) => {
			const finish = () => {
				clearCloseTimer();
				for (const dispose of disposers.splice(0)) {
					dispose();
				}
				resolve();
			};

			const scheduleCloseCheck = () => {
				if (getOpenPageCount() > 0) {
					clearCloseTimer();
					return;
				}

				if (closeTimer) {
					return;
				}

				closeTimer = setTimeout(() => {
					closeTimer = null;
					if (getOpenPageCount() === 0) {
						finish();
					}
				}, AUTH_WINDOW_CLOSE_GRACE_MS);
			};

			const watchPage = (page: Page) => {
				const handleClose = () => {
					scheduleCloseCheck();
				};

				page.on("close", handleClose);
				disposers.push(() => {
					page.off("close", handleClose);
				});
			};

			for (const page of context.pages()) {
				watchPage(page);
			}

			const handlePage = (page: Page) => {
				watchPage(page);
				scheduleCloseCheck();
			};
			const handleContextClose = () => {
				finish();
			};

			context.on("page", handlePage);
			context.on("close", handleContextClose);
			disposers.push(() => {
				context.off("page", handlePage);
			});
			disposers.push(() => {
				context.off("close", handleContextClose);
			});

			scheduleCloseCheck();
		});

	await waitForStableZeroPages();
}

async function waitForManualBrowserClose(
	context: BrowserContext,
	provider: AuthProvider,
): Promise<void> {
	const tracker = new AuthSessionTracker(context, provider);
	tracker.start();

	let finalState: PersistedStorageState | null = null;
	try {
		await waitForAllAuthPagesToClose(context);
	} finally {
		finalState = await tracker.finish();
	}

	if (!finalState) {
		throw new Error(
			`${AUTH_PROVIDER_DISPLAY[provider].displayName} sign-in window was closed before the session was captured.`,
		);
	}
	await saveReusableIdentitySessions(finalState);
	const savedState = await saveAuthSession(provider, finalState);
	await uploadAuthSession(provider, savedState);
	await context.close().catch(() => {});
}

async function runAuthLogin(provider: AuthProvider): Promise<void> {
	const authConfig = AUTH_PROVIDER_CONFIG[provider];
	const browserProvider = authConfig.providers[0];
	if (!browserProvider) {
		throw new Error(`No runtime provider is configured for ${provider}.`);
	}

	ensureAuthDirectories();
	const authSeedState = await readAuthLaunchSeedState(provider);
	const playwrightStorageState = toPlaywrightStorageState(authSeedState);
	const systemDarkMode = await detectSystemDarkMode();
	const prefersColorSchemeOverride =
		systemDarkMode === true ? 0 : systemDarkMode === false ? 1 : 2;
	const systemUsesDarkThemePref =
		systemDarkMode === true ? 1 : systemDarkMode === false ? 0 : -1;

	const launchOptions = await resolveCamoufoxLaunchOptions({
		display: detectDisplay() ?? undefined,
		provider: browserProvider,
		headlessMode: "headful",
		humanize: false,
		plainAuthMode: true,
		disableFingerprinting: true,
		// Disable Camoufox's default privacy addons for the auth browser.
		// Those addons can modify CSS rendering (e.g. block external stylesheets,
		// alter color-scheme), causing Google/OAuth pages to render incorrectly
		// (white button backgrounds, broken layout). The auth browser should look
		// and behave exactly like a stock Firefox.
		disableDefaultAddons: true,
	});

	const browser = await firefox.launch({
		...(launchOptions as BrowserLaunchOptions),
		headless: false,
		// Re-apply auth-critical prefs HERE, after Camoufox's Python launch_options
		// has already merged its own generated prefs into firefoxUserPrefs. We have
		// no control over the merge order inside Python — Camoufox can override our
		// camoufox.ts-level value with its own. Spreading them last at the Playwright
		// level guarantees they win regardless of what Camoufox produced.
		firefoxUserPrefs: {
			...(launchOptions.firefoxUserPrefs as Record<string, unknown>),
			// All prefs below are spread AFTER Camoufox's Python-merged prefs so they
			// unconditionally win, regardless of what Camoufox generated.

			// camoufox.cfg bakes in ui.use_standins_for_native_colors=true, which
			// replaces CSS system colors (Window, ButtonFace, -moz-Dialog, etc.) with
			// neutral white standins. Any element using system colors — including
			// the Google sign-in container — renders white instead of the real OS
			// color. Disabling this restores true system color rendering.
			"ui.use_standins_for_native_colors": false,

			// Use an explicit host theme value when we can detect it. Firefox's
			// automatic system-theme detection can be unreliable in local auth
			// environments, which leaves some sites with mixed dark/light surfaces.
			"ui.systemUsesDarkTheme": systemUsesDarkThemePref,

			// Reset to Firefox's default theme — camoufox.cfg forces compact-dark.
			"extensions.activeThemeID": "default-theme@mozilla.org",

			// Match website appearance to the explicit host theme when available
			// instead of relying on Firefox/Camoufox auto-detection.
			// Values: 0 = Dark, 1 = Light, 2 = System
			"layout.css.prefers-color-scheme.content-override":
				prefersColorSchemeOverride,

			// RFP unconditionally forces prefers-color-scheme to light and overrides
			// the content-override pref above. Keep disabled for auth.
			"privacy.resistFingerprinting": false,
		},
	});
	const context = await browser.newContext({
		viewport: null,
		...(playwrightStorageState
			? { storageState: playwrightStorageState }
			: {}),
	});
	attachAuthDebugLogging(context, provider);

	try {
		const page = await context.newPage();
		logger.debug(
			`[auth:${provider}] using primary page url=${page.url() || "about:blank"}`,
		);
		await page.goto(authConfig.loginUrl, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		await waitForManualBrowserClose(context, provider);
	} catch (error) {
		await writeProviderAuthStatus(provider, {
			connecting: false,
			lastUpdatedAt: new Date().toISOString(),
			syncedAt: null,
			error: error instanceof Error ? error.message : String(error),
			launcherPid: null,
		});
		await context.close().catch(() => {});
		await browser.close().catch(() => {});
		throw error;
	}

	await browser.close().catch(() => {});
}

const provider = parseProviderArg(process.argv.slice(2));
runAuthLogin(provider).then(() => process.exit(0)).catch((error) => {
	const runtimeProvider = AUTH_PROVIDER_CONFIG[provider].providers[0];
	const providerName = runtimeProvider
		? getProviderDisplayName(runtimeProvider)
		: provider;
	console.error(`[auth] ${providerName} login failed:`, error);
	process.exit(1);
});
