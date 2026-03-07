import { randomBytes } from "node:crypto";
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

const DECODO_DEFAULT_SESSION_MINUTES = "30";
const THORDATA_DEFAULT_SESSION_MINUTES = "10";
const IPROYAL_DEFAULT_LIFETIME = "10m";
const SOAX_DEFAULT_SESSION_SECONDS = "360";

type PortRange = {
	start: number;
	end: number;
};

const DECODO_STICKY_RANGES = new Map<string, PortRange>([
	["gate.decodo.com", { start: 10_001, end: 49_999 }],
	["us.decodo.com", { start: 10_001, end: 29_999 }],
	["eu.decodo.com", { start: 10_001, end: 29_999 }],
	["in.decodo.com", { start: 10_001, end: 19_999 }],
	["es.decodo.com", { start: 10_001, end: 19_999 }],
	["ar.decodo.com", { start: 10_001, end: 19_999 }],
	["ae.decodo.com", { start: 20_001, end: 29_999 }],
	["tw.decodo.com", { start: 20_001, end: 29_999 }],
	["pt.decodo.com", { start: 20_001, end: 29_999 }],
	["se.decodo.com", { start: 20_001, end: 29_999 }],
	["my.decodo.com", { start: 30_001, end: 39_999 }],
	["jp.decodo.com", { start: 30_001, end: 39_999 }],
	["gr.decodo.com", { start: 30_001, end: 39_999 }],
	["az.decodo.com", { start: 30_001, end: 39_999 }],
	["ph.decodo.com", { start: 40_001, end: 49_999 }],
	["be.decodo.com", { start: 40_001, end: 49_999 }],
	["ua.decodo.com", { start: 40_001, end: 49_999 }],
	["pe.decodo.com", { start: 40_001, end: 49_999 }],
]);
const DECODO_ROTATING_PORTS = new Map<string, number[]>([
	["gate.decodo.com", [7000, 10_000]],
	["us.decodo.com", [10_000]],
	["eu.decodo.com", [10_000]],
	["in.decodo.com", [10_000]],
	["es.decodo.com", [10_000]],
	["ar.decodo.com", [10_000]],
	["ae.decodo.com", [20_000]],
	["tw.decodo.com", [20_000]],
	["pt.decodo.com", [20_000]],
	["se.decodo.com", [20_000]],
	["my.decodo.com", [30_000]],
	["jp.decodo.com", [30_000]],
	["gr.decodo.com", [30_000]],
	["az.decodo.com", [30_000]],
	["ph.decodo.com", [40_000]],
	["be.decodo.com", [40_000]],
	["ua.decodo.com", [40_000]],
	["pe.decodo.com", [40_000]],
]);
const OXYLABS_STICKY_RANGES = new Map<string, PortRange>([
	["pr.oxylabs.io", { start: 10_000, end: 49_999 }],
	["us-pr.oxylabs.io", { start: 10_001, end: 19_999 }],
	["ca-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["gb-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["de-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["fr-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["es-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["it-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["se-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["gr-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["pt-pr.oxylabs.io", { start: 20_001, end: 29_999 }],
	["nl-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["be-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["ru-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["ua-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["pl-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["il-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["tr-pr.oxylabs.io", { start: 30_001, end: 39_999 }],
	["au-pr.oxylabs.io", { start: 40_001, end: 49_999 }],
	["my-pr.oxylabs.io", { start: 40_001, end: 49_999 }],
]);

function normalizeHostKey(host: string): string {
	return host.trim().toLowerCase().replace(/\.$/, "");
}

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

function stripUnderscoreToken(value: string, tokenName: string): string {
	return value.replace(new RegExp(`_${tokenName}-[^_]+`, "gi"), "");
}

function setDotKeyValue(
	value: string,
	key: string,
	tokenValue: string,
): string {
	const base = stripDotKeyValue(value, key).replace(/\.+$/g, "");
	return base ? `${base}.${key}=${tokenValue}` : `${key}=${tokenValue}`;
}

function setUnderscoreToken(
	value: string,
	tokenName: string,
	tokenValue: string,
): string {
	const base = stripUnderscoreToken(value, tokenName).replace(/_+$/g, "");
	return base
		? `${base}_${tokenName}-${tokenValue}`
		: `${tokenName}-${tokenValue}`;
}

function readUnderscoreToken(
	value: string,
	tokenName: string,
): string | undefined {
	return value.match(new RegExp(`_${tokenName}-([^_]+)`, "i"))?.[1];
}

function randomInt(min: number, max: number): number {
	if (max <= min) return min;
	const range = max - min + 1;
	const maxExclusive = 0x1_0000_0000;
	const limit = Math.floor(maxExclusive / range) * range;
	let value = 0;

	do {
		value = randomBytes(4).readUInt32BE(0);
	} while (value >= limit);

	return min + (value % range);
}

function isPortInRange(port: number, range: PortRange): boolean {
	return port >= range.start && port <= range.end;
}

function pickRandomPort(range: PortRange): number {
	return randomInt(range.start, range.end);
}

function pickRandomPortInLegacyBand(port: number): number {
	const bandBase = Math.floor(port / 10_000) * 10_000;
	return pickRandomPort({
		start: bandBase + 1,
		end: bandBase + 9_999,
	});
}

function resolveDecodoStickyRange(host: string): PortRange | undefined {
	return DECODO_STICKY_RANGES.get(normalizeHostKey(host));
}

function shouldRandomizeDecodoPort(host: string, port: number): boolean {
	const normalizedHost = normalizeHostKey(host);
	const stickyRange = DECODO_STICKY_RANGES.get(normalizedHost);
	if (!stickyRange) {
		return port >= 10_001 && port <= 49_999;
	}

	const rotatingPorts = DECODO_ROTATING_PORTS.get(normalizedHost) ?? [];
	return rotatingPorts.includes(port) || isPortInRange(port, stickyRange);
}

function resolveOxylabsStickyRange(host: string): PortRange | undefined {
	return OXYLABS_STICKY_RANGES.get(normalizeHostKey(host));
}

function shouldRandomizeOxylabsPort(host: string, port: number): boolean {
	const stickyRange = resolveOxylabsStickyRange(host);
	if (!stickyRange) {
		return port >= 10_001 && port <= 49_999;
	}

	if (normalizeHostKey(host) === "pr.oxylabs.io") {
		return isPortInRange(port, stickyRange);
	}

	return port === 10_000 || isPortInRange(port, stickyRange);
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
		Pick<
			UpstreamProxyConfig,
			"scheme" | "host" | "port" | "username" | "password"
		>
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

function applyDecodoStrategy(proxy: UpstreamProxyConfig): UpstreamProxyConfig {
	const sessionId = randomAlphaNumeric(12);
	const username = proxy.username ?? "";
	const sessionDuration =
		readDashToken(username, "sessionduration") ??
		DECODO_DEFAULT_SESSION_MINUTES;

	if (shouldRandomizeDecodoPort(proxy.host, proxy.port)) {
		const stickyRange = resolveDecodoStickyRange(proxy.host);
		return withProxy(proxy, {
			port: stickyRange
				? pickRandomPort(stickyRange)
				: pickRandomPortInLegacyBand(proxy.port),
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
): UpstreamProxyConfig {
	const username = proxy.username ?? "";
	const normalizedHost = normalizeHostKey(proxy.host);
	const inferredScheme =
		/\.thordata\.online$/i.test(normalizedHost) ||
		normalizedHost === "thordata.online"
			? "https"
			: /\.pr\.thordata\.net$/i.test(normalizedHost) ||
					normalizedHost === "pr.thordata.net" ||
					normalizedHost === "t.pr.thordata.net"
				? "http"
				: proxy.scheme;
	const isManagedThorHost =
		normalizedHost === "pr.thordata.net" ||
		normalizedHost === "t.pr.thordata.net" ||
		normalizedHost.endsWith(".thordata.online");

	if (!username) {
		return inferredScheme === proxy.scheme
			? proxy
			: withProxy(proxy, { scheme: inferredScheme });
	}

	// Preserve provider-issued credentials on custom ThorData hosts instead of
	// inventing a new session id that the endpoint may not accept.
	if (!isManagedThorHost && /-sessid-/i.test(username)) {
		return inferredScheme === proxy.scheme
			? proxy
			: withProxy(proxy, { scheme: inferredScheme });
	}
	const sessionTime =
		readDashToken(username, "sesstime") ?? THORDATA_DEFAULT_SESSION_MINUTES;

	return withProxy(proxy, {
		scheme: inferredScheme,
		username: setDashToken(
			setDashToken(username, "sessid", randomAlphaNumeric(12)),
			"sesstime",
			sessionTime,
		),
	});
}

function applyBrightDataStrategy(
	proxy: UpstreamProxyConfig,
): UpstreamProxyConfig {
	if (!proxy.username) {
		return proxy;
	}
	return withProxy(proxy, {
		username: setDashToken(proxy.username, "session", randomAlphaNumeric(12)),
	});
}

function applyOxylabsStrategy(proxy: UpstreamProxyConfig): UpstreamProxyConfig {
	const username = proxy.username ?? "";
	if (shouldRandomizeOxylabsPort(proxy.host, proxy.port)) {
		const stickyRange = resolveOxylabsStickyRange(proxy.host);
		return withProxy(proxy, {
			port: stickyRange
				? pickRandomPort(stickyRange)
				: pickRandomPortInLegacyBand(proxy.port),
		});
	}

	if (/-sessid-/i.test(username)) {
		const sessionTime = readDashToken(username, "sesstime");
		let nextUsername = setDashToken(username, "sessid", randomAlphaNumeric(12));
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
	if (!proxy.password) {
		return proxy;
	}

	const password = proxy.password;
	const lifetime =
		readUnderscoreToken(password, "lifetime") ?? IPROYAL_DEFAULT_LIFETIME;

	return withProxy(proxy, {
		password: setUnderscoreToken(
			setUnderscoreToken(password, "session", randomAlphaNumeric(8)),
			"lifetime",
			lifetime,
		),
	});
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

export function applyProxyProviderStrategy(
	proxy: UpstreamProxyConfig,
): UpstreamProxyConfig {
	const kind = resolveProxyProviderKind();
	if (kind === "generic") {
		return proxy;
	}

	switch (kind) {
		case "decodo":
			return applyDecodoStrategy(proxy);
		case "thordata":
		case "lunaproxy":
			return applyThorFamilyStrategy(proxy);
		case "brightdata":
			return applyBrightDataStrategy(proxy);
		case "oxylabs":
			return applyOxylabsStrategy(proxy);
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
