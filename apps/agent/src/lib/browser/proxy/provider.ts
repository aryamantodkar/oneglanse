import { randomBytes } from "node:crypto";
import type { Provider } from "@oneglanse/types";
import { env } from "../../../env.js";
import type { UpstreamProxyConfig } from "./forwarder.js";

// Provider-specific session rotation rules. The goal is one stable upstream
// session per browser launch, then a fresh session on the next launch.
export type ProxyProviderKind =
	| "generic"
	| "brightdata"
	| "decodo"
	| "iproyal"
	| "lunaproxy"
	| "netnut"
	| "oxylabs"
	| "proxyempire"
	| "scrapeops"
	| "soax"
	| "thordata"
	| "webshare";

const STICKY_PORT_BLOCK_SIZE = 10_000;
const DECODO_DEFAULT_SESSION_MINUTES = "30";
const THORDATA_DEFAULT_SESSION_MINUTES = "30";
const SOAX_DEFAULT_SESSION_SECONDS = "360";
const PROXY_PORT_COUNTERS = new Map<string, number>();

function wrapHostForUrl(host: string): string {
	return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function buildServerUrl(proxy: UpstreamProxyConfig): string {
	return `${proxy.scheme}://${wrapHostForUrl(proxy.host)}:${proxy.port}`;
}

function randomAlphaNumeric(length: number): string {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = randomBytes(length);
	let value = "";
	for (let index = 0; index < length; index += 1) {
		const byte = bytes[index] ?? 0;
		value += alphabet[byte % alphabet.length] ?? alphabet[0];
	}
	return value;
}

function randomDigits(length: number): string {
	const bytes = randomBytes(length);
	let value = "";
	for (let index = 0; index < length; index += 1) {
		value += String((bytes[index] ?? 0) % 10);
	}
	return value;
}

function stripDashToken(value: string, tokenName: string): string {
	return value.replace(new RegExp(`-${tokenName}-[^-]+`, "gi"), "");
}

function setDashToken(
	value: string,
	tokenName: string,
	tokenValue: string,
): string {
	const base = stripDashToken(value, tokenName).replace(/-+$/g, "");
	return base
		? `${base}-${tokenName}-${tokenValue}`
		: `${tokenName}-${tokenValue}`;
}

function readDashToken(value: string, tokenName: string): string | undefined {
	return value.match(new RegExp(`-${tokenName}-([^-]+)`, "i"))?.[1];
}

function stripDotKeyValue(value: string, key: string): string {
	return value.replace(new RegExp(`\\.${key}=[^.]+`, "gi"), "");
}

function setDotKeyValue(
	value: string,
	key: string,
	tokenValue: string,
): string {
	const base = stripDotKeyValue(value, key).replace(/\.+$/g, "");
	return base ? `${base}.${key}=${tokenValue}` : `${key}=${tokenValue}`;
}

function rotatePortInBlock(host: string, port: number): number {
	const blockStart =
		Math.floor((port - 1) / STICKY_PORT_BLOCK_SIZE) * STICKY_PORT_BLOCK_SIZE +
		1;
	const blockEnd = blockStart + STICKY_PORT_BLOCK_SIZE - 1;
	const counterKey = `${host}:${blockStart}:${blockEnd}`;
	const current = PROXY_PORT_COUNTERS.get(counterKey) ?? port;
	const next =
		current >= blockStart && current <= blockEnd ? current : blockStart;
	PROXY_PORT_COUNTERS.set(
		counterKey,
		next + 1 > blockEnd ? blockStart : next + 1,
	);
	return next;
}

function setDecodoSessionHost(
	host: string,
	sessionId: string,
	sessionDurationMinutes: string,
): string {
	if (!/gate\.decodo\.com$/i.test(host)) {
		return host;
	}

	const withoutSessionPrefix = host.replace(
		/^session-[^.]+-sessionduration-[^.]+\./i,
		"",
	);
	return `session-${sessionId}-sessionduration-${sessionDurationMinutes}.${withoutSessionPrefix}`;
}

function withProxy(
	proxy: UpstreamProxyConfig,
	overrides: Partial<
		Pick<UpstreamProxyConfig, "host" | "port" | "username" | "password">
	>,
): UpstreamProxyConfig {
	const nextProxy: UpstreamProxyConfig = {
		...proxy,
		...overrides,
	};
	const serverUrl = buildServerUrl(nextProxy);
	return {
		...nextProxy,
		serverUrl,
		logProxy: serverUrl,
	};
}

function applyDecodoStrategy(
	proxy: UpstreamProxyConfig,
	targetProvider: Provider,
): UpstreamProxyConfig {
	const sessionId = `${targetProvider}-${randomAlphaNumeric(10)}`;
	const username = proxy.username ?? "";
	const sessionDuration =
		readDashToken(username, "sessionduration") ??
		DECODO_DEFAULT_SESSION_MINUTES;

	if (proxy.port >= 10_001 && proxy.port <= 49_999) {
		return withProxy(proxy, {
			port: rotatePortInBlock(proxy.host, proxy.port),
		});
	}

	if (!username && /gate\.decodo\.com$/i.test(proxy.host)) {
		return withProxy(proxy, {
			host: setDecodoSessionHost(proxy.host, sessionId, sessionDuration),
		});
	}

	if (!username) {
		return proxy;
	}

	return withProxy(proxy, {
		username: setDashToken(
			setDashToken(username, "session", sessionId),
			"sessionduration",
			sessionDuration,
		),
	});
}

function applyThorFamilyStrategy(
	proxy: UpstreamProxyConfig,
	targetProvider: Provider,
): UpstreamProxyConfig {
	const username = proxy.username ?? "";
	if (!username) {
		return proxy;
	}
	const sessionTime =
		readDashToken(username, "sesstime") ?? THORDATA_DEFAULT_SESSION_MINUTES;

	return withProxy(proxy, {
		username: setDashToken(
			setDashToken(
				username,
				"sessid",
				`${targetProvider.slice(0, 3)}${randomAlphaNumeric(12)}`,
			),
			"sesstime",
			sessionTime,
		),
	});
}

function applyBrightDataStrategy(
	proxy: UpstreamProxyConfig,
	targetProvider: Provider,
): UpstreamProxyConfig {
	if (!proxy.username) {
		return proxy;
	}
	return withProxy(proxy, {
		username: setDashToken(
			proxy.username ?? "",
			"session",
			`${targetProvider}-${randomAlphaNumeric(10)}`,
		),
	});
}

function applyOxylabsStrategy(
	proxy: UpstreamProxyConfig,
	targetProvider: Provider,
): UpstreamProxyConfig {
	const username = proxy.username ?? "";
	if (proxy.port >= 10_001 && proxy.port <= 49_999) {
		return withProxy(proxy, {
			port: rotatePortInBlock(proxy.host, proxy.port),
		});
	}

	if (/-sessid-/i.test(username)) {
		const sessionTime = readDashToken(username, "sesstime");
		let nextUsername = setDashToken(
			username,
			"sessid",
			`${targetProvider.slice(0, 3)}${randomAlphaNumeric(10)}`,
		);
		if (sessionTime) {
			nextUsername = setDashToken(nextUsername, "sesstime", sessionTime);
		}
		return withProxy(proxy, { username: nextUsername });
	}

	return proxy;
}

function applyNetNutStrategy(proxy: UpstreamProxyConfig): UpstreamProxyConfig {
	if (!proxy.username) {
		return proxy;
	}
	return withProxy(proxy, {
		username: setDashToken(proxy.username ?? "", "sid", randomDigits(9)),
	});
}

function applySoaxStrategy(proxy: UpstreamProxyConfig): UpstreamProxyConfig {
	const username = proxy.username ?? "";
	if (!username) {
		return proxy;
	}
	const sessionLength =
		readDashToken(username, "sessionlength") ?? SOAX_DEFAULT_SESSION_SECONDS;
	return withProxy(proxy, {
		username: setDashToken(
			setDashToken(username, "sessionid", randomAlphaNumeric(10)),
			"sessionlength",
			sessionLength,
		),
	});
}

function applyScrapeOpsStrategy(
	proxy: UpstreamProxyConfig,
): UpstreamProxyConfig {
	const username = proxy.username ?? "";
	if (!username) {
		return proxy;
	}

	return withProxy(proxy, {
		username: setDotKeyValue(
			username,
			"sticky_session",
			String(1 + (randomBytes(2).readUInt16BE(0) % 10_000)),
		),
	});
}

function applyProxyEmpireStrategy(
	proxy: UpstreamProxyConfig,
): UpstreamProxyConfig {
	if (!proxy.username) {
		return proxy;
	}
	return withProxy(proxy, {
		username: setDashToken(proxy.username ?? "", "sid", randomDigits(8)),
	});
}

function applyIpRoyalStrategy(proxy: UpstreamProxyConfig): UpstreamProxyConfig {
	// IPRoyal sticky sessions are typically pre-generated as static ip:port:user:pass
	// entries in the dashboard, so we deliberately keep credentials untouched.
	return proxy;
}

function applyWebshareStrategy(
	proxy: UpstreamProxyConfig,
): UpstreamProxyConfig {
	// Webshare rotating/backbone endpoints already rotate provider-side. We avoid
	// inventing unsupported session parameters.
	return proxy;
}

export function resolveProxyProviderKind(): ProxyProviderKind {
	switch (env.PROXY_PROVIDER ?? "generic") {
		case "smartproxy":
			return "decodo";
		default:
			return (env.PROXY_PROVIDER ?? "generic") as ProxyProviderKind;
	}
}

export function usesDynamicProxyStrategy(): boolean {
	return resolveProxyProviderKind() !== "generic";
}

export function applyProxyProviderStrategy(
	proxy: UpstreamProxyConfig,
	targetProvider: Provider,
): UpstreamProxyConfig {
	switch (resolveProxyProviderKind()) {
		case "decodo":
			return applyDecodoStrategy(proxy, targetProvider);
		case "thordata":
		case "lunaproxy":
			return applyThorFamilyStrategy(proxy, targetProvider);
		case "brightdata":
			return applyBrightDataStrategy(proxy, targetProvider);
		case "oxylabs":
			return applyOxylabsStrategy(proxy, targetProvider);
		case "netnut":
			return applyNetNutStrategy(proxy);
		case "soax":
			return applySoaxStrategy(proxy);
		case "scrapeops":
			return applyScrapeOpsStrategy(proxy);
		case "proxyempire":
			return applyProxyEmpireStrategy(proxy);
		case "iproyal":
			return applyIpRoyalStrategy(proxy);
		case "webshare":
			return applyWebshareStrategy(proxy);
		default:
			return proxy;
	}
}
