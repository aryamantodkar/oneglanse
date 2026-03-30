import { firefox } from "playwright-core";
import { AUTH_PROVIDER_LIST, type AuthProvider } from "@oneglanse/types";
import {
	ensureAuthDirectories,
	getAuthProfileDir,
	saveAuthSession,
	uploadAuthSession,
	writeProviderAuthStatus,
} from "@oneglanse/services";
import {
	AUTH_PROVIDER_CONFIG,
	AUTH_PROVIDER_DISPLAY,
	getProviderDisplayName,
} from "@oneglanse/utils";
import { resolveCamoufoxLaunchOptions } from "../lib/browser/camoufox.js";
import { detectDisplay } from "../lib/browser/display.js";

const AUTH_READY_TIMEOUT_MS = 30 * 60 * 1000;
const AUTH_READY_POLL_MS = 1_500;

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

function matchesDomainSuffix(
	hostOrDomain: string,
	suffixes: string[],
): boolean {
	const normalized = hostOrDomain.replace(/^\./, "").toLowerCase();
	return suffixes.some(
		(suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
	);
}

async function getPrimaryPage(
	context: import("playwright-core").BrowserContext,
): Promise<import("playwright-core").Page> {
	const existing = context
		.pages()
		.find((page) => !page.isClosed() && page.url() !== "about:blank");
	if (existing) {
		return existing;
	}

	const firstPage = context.pages().find((page) => !page.isClosed());
	if (firstPage) {
		return firstPage;
	}

	return context.newPage();
}

async function pageLooksAuthenticated(
	page: import("playwright-core").Page,
	provider: AuthProvider,
): Promise<boolean> {
	const authConfig = AUTH_PROVIDER_CONFIG[provider];
	const currentUrl = page.url();

	try {
		const host = new URL(currentUrl).hostname;
		if (!matchesDomainSuffix(host, authConfig.domainSuffixes)) {
			return false;
		}
	} catch {
		return false;
	}

	const bodyText = await page
		.evaluate(() =>
			(document.body?.innerText || "").replace(/\s+/g, " ").trim(),
		)
		.catch(() => "");
	if (!bodyText) {
		return false;
	}

	return !/\b(log in|login|sign in|sign up|create account|continue with google|continue with email|continue with apple)\b/i.test(
		bodyText,
	);
}

async function visitPostLoginUrls(
	page: import("playwright-core").Page,
	provider: AuthProvider,
): Promise<void> {
	const urls = [...new Set(AUTH_PROVIDER_CONFIG[provider].postLoginUrls)];
	for (const url of urls) {
		await page.goto(url, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		await page.waitForTimeout(1_000);
	}
}

async function waitForAuthenticatedSession(
	context: import("playwright-core").BrowserContext,
	provider: AuthProvider,
): Promise<void> {
	const deadline = Date.now() + AUTH_READY_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const activePages = context.pages().filter((page) => !page.isClosed());
		if (activePages.length === 0) {
			throw new Error(
				`${AUTH_PROVIDER_DISPLAY[provider].displayName} sign-in window was closed before the session was captured.`,
			);
		}

		const page =
			activePages[activePages.length - 1] ?? (await getPrimaryPage(context));
		if (await pageLooksAuthenticated(page, provider)) {
			await visitPostLoginUrls(page, provider);
			const storageState = await context.storageState();
			const savedState = await saveAuthSession(provider, storageState);
			await uploadAuthSession(provider, savedState);
			return;
		}

		await page.waitForTimeout(AUTH_READY_POLL_MS);
	}

	throw new Error(
		`${AUTH_PROVIDER_DISPLAY[provider].displayName} sign-in timed out after ${Math.round(AUTH_READY_TIMEOUT_MS / 60000)} minutes.`,
	);
}

async function runAuthLogin(provider: AuthProvider): Promise<void> {
	const authConfig = AUTH_PROVIDER_CONFIG[provider];
	const browserProvider = authConfig.providers[0];
	if (!browserProvider) {
		throw new Error(`No runtime provider is configured for ${provider}.`);
	}

	ensureAuthDirectories();
	await writeProviderAuthStatus(provider, {
		connecting: true,
		lastUpdatedAt: new Date().toISOString(),
		syncedAt: null,
		error: null,
	});

	const launchOptions = await resolveCamoufoxLaunchOptions({
		display: detectDisplay() ?? undefined,
		provider: browserProvider,
		headlessMode: "headful",
	});

	const context = await firefox.launchPersistentContext(
		getAuthProfileDir(provider),
		{
			...(launchOptions as NonNullable<
				Parameters<typeof firefox.launchPersistentContext>[1]
			>),
			headless: false,
		},
	);

	try {
		const page = await getPrimaryPage(context);
		await page.goto(authConfig.loginUrl, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		await waitForAuthenticatedSession(context, provider);
	} catch (error) {
		await writeProviderAuthStatus(provider, {
			connecting: false,
			lastUpdatedAt: new Date().toISOString(),
			syncedAt: null,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	} finally {
		await context.close().catch(() => null);
	}
}

const provider = parseProviderArg(process.argv.slice(2));
runAuthLogin(provider).catch((error) => {
	const runtimeProvider = AUTH_PROVIDER_CONFIG[provider].providers[0];
	const providerName = runtimeProvider
		? getProviderDisplayName(runtimeProvider)
		: provider;
	console.error(`[auth] ${providerName} login failed:`, error);
	process.exit(1);
});
