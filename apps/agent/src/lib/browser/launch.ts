import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";
import { logger } from "@oneglanse/utils";
import { fetchProxies, getNextProxy, recordProxyResult } from "./proxy/pool.js";
import { env } from "../../env.js";
import {
	STEALTH_CHROME_ARGS,
	STEALTH_CONTEXT_OPTIONS,
	STEALTH_INIT_SCRIPT,
} from "./stealth.js";
const SESSION_PLACEHOLDER_RE =
	/\{\{\s*(?:sessid|sessionid|session_id)\s*\}\}|\$\{?\s*(?:sessid|sessionid|session_id)\s*\}?/gi;
const SESSION_KEY_VALUE_RE =
	/((?:sessid|sessionid|session_id|session)[-_:=])([A-Za-z0-9._~%]+)/i;

type ProxyAuth = {
	username: string;
	password: string;
	sessionId: string;
};

function generateProxySessionId(provider: Provider): string {
	const providerTag = provider.slice(0, 3).toLowerCase();
	const pidTag = process.pid.toString(36);
	const timeTag = Date.now().toString(36);
	const entropyTag = randomUUID().replace(/-/g, "").slice(0, 12);
	return `${providerTag}${pidTag}${timeTag}${entropyTag}`;
}

function withDynamicSessionId(username: string, sessionId: string): string {
	const withPlaceholder = username.replace(SESSION_PLACEHOLDER_RE, sessionId);
	if (withPlaceholder !== username) {
		return withPlaceholder;
	}

	if (SESSION_KEY_VALUE_RE.test(username)) {
		return username.replace(SESSION_KEY_VALUE_RE, `$1${sessionId}`);
	}

	return `${username}-sessid-${sessionId}`;
}

function buildProxyAuth(provider: Provider): ProxyAuth | null {
	const baseUsername = env.PROXY_USERNAME?.trim();
	const basePassword = env.PROXY_PASSWORD?.trim();
	if (!baseUsername || !basePassword) return null;

	const sessionId = generateProxySessionId(provider);

	return {
		username: withDynamicSessionId(baseUsername, sessionId),
		password: basePassword,
		sessionId,
	};
}

export async function launchContext(
	provider: Provider,
): Promise<{
	browser: Browser;
	context: BrowserContext;
	proxy: string | null;
	cleanup: () => Promise<void>;
}> {
	let proxy = getNextProxy();

	if (!proxy) {
		logger.warn(`proxy pool exhausted, refreshing...`);
		try {
			await fetchProxies({ forceRefresh: true });
			proxy = getNextProxy();
		} catch (err) {
			logger.error(`failed to refresh proxy pool:`, toErrorMessage(err));
		}
	}

	if (proxy) {
		const redactedProxy =
			proxy?.replace(/\/\/[^:]+:[^@]+@/, "//***:***@") ?? "none";
		logger.log(`using proxy: ${redactedProxy}`);
	} else {
		logger.warn("no proxies available, launching without proxy");
	}

	const proxyAuth = buildProxyAuth(provider);
	if (proxy && proxyAuth) {
		logger.log(
			`proxy auth enabled via PROXY_USERNAME/PROXY_PASSWORD (sessid ${proxyAuth.sessionId})`,
		);
	}

	const launchProxyConfig = proxy
		? {
				server: proxy,
				...(proxyAuth
					? {
							username: proxyAuth.username,
							password: proxyAuth.password,
						}
					: {}),
			}
		: undefined;

	logger.log(`launching chromium${proxy ? " (proxy)" : " (direct)"}`);

	let browser: Browser | null = null;

	const cleanup = async () => {
		await browser?.close().catch(() => null);
	};

	try {
		browser = await chromium.launch({
			headless: true,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-blink-features=AutomationControlled",
				...STEALTH_CHROME_ARGS,
			],
			...(launchProxyConfig ? { proxy: launchProxyConfig } : {}),
		});

		const context = await browser.newContext({
			viewport: { width: 1920, height: 1080 },
			...STEALTH_CONTEXT_OPTIONS,
		});

		await context.addInitScript(STEALTH_INIT_SCRIPT);
		return { browser, context, proxy, cleanup };
	} catch (err) {
		if (proxy) {
			const isTimeout =
				toErrorMessage(err).toLowerCase().includes("timeout");
			recordProxyResult(
				proxy,
				false,
				isTimeout ? "timeout" : "connection_error",
				provider,
			);
			if (proxyAuth) {
				logger.warn(
					`browser launch failed; session id ${proxyAuth.sessionId} will be rotated on retry`,
				);
			}
		}
		await cleanup();
		throw new ExternalServiceError(
			"browser",
			toErrorMessage(err),
			502,
			{ provider },
			err,
		);
	}
}
