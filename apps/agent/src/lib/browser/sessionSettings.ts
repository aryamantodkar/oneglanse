import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { env } from "../../env.js";
import {
	type BrowserSessionSettings,
	getDefaultBrowserSessionSettings,
} from "./stealth.js";

const GEO_LOOKUP_URL =
	"http://ip-api.com/json/?fields=status,countryCode,timezone,lat,lon";
const GEO_LOOKUP_TIMEOUT_MS = 2_500;
const GEO_ACCURACY_METERS = 25;

const LOCALE_BY_COUNTRY: Record<string, string> = {
	AE: "ar-AE",
	AR: "es-AR",
	AT: "de-AT",
	AU: "en-AU",
	BE: "nl-BE",
	BR: "pt-BR",
	CA: "en-CA",
	CH: "de-CH",
	CL: "es-CL",
	CO: "es-CO",
	CZ: "cs-CZ",
	DE: "de-DE",
	DK: "da-DK",
	EG: "ar-EG",
	ES: "es-ES",
	FI: "fi-FI",
	FR: "fr-FR",
	GB: "en-GB",
	GR: "el-GR",
	HK: "zh-HK",
	HU: "hu-HU",
	ID: "id-ID",
	IE: "en-IE",
	IL: "he-IL",
	IN: "en-IN",
	IT: "it-IT",
	JP: "ja-JP",
	KR: "ko-KR",
	MX: "es-MX",
	MY: "ms-MY",
	NL: "nl-NL",
	NO: "nb-NO",
	NZ: "en-NZ",
	PH: "en-PH",
	PL: "pl-PL",
	PT: "pt-PT",
	RO: "ro-RO",
	RU: "ru-RU",
	SA: "ar-SA",
	SE: "sv-SE",
	SG: "en-SG",
	TH: "th-TH",
	TR: "tr-TR",
	TW: "zh-TW",
	UA: "uk-UA",
	US: "en-US",
	VN: "vi-VN",
	ZA: "en-ZA",
};

type GeoLookupResult = {
	countryCode?: string;
	timezoneId?: string;
	latitude?: number;
	longitude?: number;
};

const settingsCache = new Map<string, BrowserSessionSettings>();

function buildAcceptLanguage(locale: string): string {
	const baseLanguage = locale.split("-")[0] ?? "en";
	if (baseLanguage.toLowerCase() === locale.toLowerCase()) {
		return `${locale},en;q=0.9`;
	}
	return `${locale},${baseLanguage};q=0.9,en;q=0.8`;
}

function toFiniteNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

function normalizeGeoLookupPayload(payload: unknown): GeoLookupResult | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}

	const record = payload as Record<string, unknown>;
	if ("status" in record && record.status !== "success") {
		return null;
	}
	if ("success" in record && record.success === false) {
		return null;
	}

	const timezoneValue = record.timezone;
	const timezoneId =
		typeof timezoneValue === "string"
			? timezoneValue
			: timezoneValue &&
					typeof timezoneValue === "object" &&
					typeof (timezoneValue as Record<string, unknown>).id === "string"
				? String((timezoneValue as Record<string, unknown>).id)
				: undefined;

	return {
		countryCode:
			typeof record.countryCode === "string"
				? record.countryCode.toUpperCase()
				: typeof record.country_code === "string"
					? record.country_code.toUpperCase()
					: undefined,
		timezoneId,
		latitude: toFiniteNumber(record.lat ?? record.latitude),
		longitude: toFiniteNumber(record.lon ?? record.longitude),
	};
}

function fetchJson(
	targetUrl: string,
	proxyServer?: string,
	timeoutMs = GEO_LOOKUP_TIMEOUT_MS,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const target = new URL(targetUrl);
		const requestTarget = proxyServer ? new URL(proxyServer) : target;
		const requestFactory =
			requestTarget.protocol === "https:" ? httpsRequest : httpRequest;
		const path = proxyServer
			? target.toString()
			: `${target.pathname}${target.search}`;

		const request = requestFactory(
			{
				protocol: requestTarget.protocol,
				hostname: requestTarget.hostname,
				port: requestTarget.port
					? Number(requestTarget.port)
					: requestTarget.protocol === "https:"
						? 443
						: 80,
				method: "GET",
				path,
				headers: {
					Accept: "application/json",
					Host: target.host,
					"User-Agent":
						"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
				},
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Buffer | string) => {
					chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
				});
				response.on("end", () => {
					const body = Buffer.concat(chunks).toString("utf8");
					if (
						response.statusCode &&
						(response.statusCode < 200 || response.statusCode >= 300)
					) {
						reject(
							new Error(
								`geo lookup failed (${response.statusCode}): ${body.slice(0, 160)}`,
							),
						);
						return;
					}

					try {
						resolve(JSON.parse(body));
					} catch (error) {
						reject(error);
					}
				});
			},
		);

		request.setTimeout(timeoutMs, () => {
			request.destroy(new Error("geo lookup timeout"));
		});
		request.once("error", reject);
		request.end();
	});
}

export async function resolveBrowserSessionSettings(
	proxyServer?: string,
): Promise<BrowserSessionSettings> {
	const baseSettings = getDefaultBrowserSessionSettings();
	const cacheKey = proxyServer ?? "direct";
	const cached = settingsCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const hasExplicitLocale = Boolean(env.BROWSER_LOCALE?.trim());
	const hasExplicitAcceptLanguage = Boolean(
		env.BROWSER_ACCEPT_LANGUAGE?.trim(),
	);
	const hasExplicitTimezone = Boolean(env.BROWSER_TIMEZONE?.trim());

	try {
		const payload = await fetchJson(GEO_LOOKUP_URL, proxyServer);
		const geo = normalizeGeoLookupPayload(payload);
		if (!geo) {
			settingsCache.set(cacheKey, baseSettings);
			return baseSettings;
		}

		const locale =
			hasExplicitLocale || !geo.countryCode
				? baseSettings.locale
				: (LOCALE_BY_COUNTRY[geo.countryCode] ?? baseSettings.locale);
		const acceptLanguage = hasExplicitAcceptLanguage
			? baseSettings.acceptLanguage
			: buildAcceptLanguage(locale);
		const timezoneId =
			hasExplicitTimezone || !geo.timezoneId
				? baseSettings.timezoneId
				: geo.timezoneId;

		const settings: BrowserSessionSettings = {
			locale,
			acceptLanguage,
			timezoneId,
			geolocation:
				typeof geo.latitude === "number" && typeof geo.longitude === "number"
					? {
							latitude: geo.latitude,
							longitude: geo.longitude,
							accuracy: GEO_ACCURACY_METERS,
						}
					: undefined,
		};

		settingsCache.set(cacheKey, settings);
		return settings;
	} catch {
		settingsCache.set(cacheKey, baseSettings);
		return baseSettings;
	}
}
