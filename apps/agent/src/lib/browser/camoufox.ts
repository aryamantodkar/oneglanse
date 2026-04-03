import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import { type Provider, resolveAppMode } from "@oneglanse/types";

const execFileAsync = promisify(execFile);
const PYTHON_CANDIDATES = ["python3.12", "python3.11", "python3.10", "python3"];
const PYTHON_PROBE_TIMEOUT_MS = 5_000;
const CAMOUFOX_OPTIONS_TIMEOUT_MS = 30_000;
const SYSTEM_FONTS_TIMEOUT_MS = 15_000;
const DEFAULT_CAMOUFOX_HEADLESS_MODE = "virtual";

const PYTHON_PROBE_SCRIPT = `
import json
import sys

print(json.dumps({
    "major": sys.version_info.major,
    "minor": sys.version_info.minor,
    "version": sys.version.split()[0],
}))
`;

const CAMOUFOX_OPTIONS_SCRIPT = `
import json
import os
import sys

try:
    from browserforge.fingerprints import Fingerprint, Screen
    from camoufox.addons import DefaultAddons
    from camoufox.pkgman import OS_NAME
    from camoufox.utils import launch_options
except Exception as exc:
    print(f"CAMOUFOX_IMPORT_ERROR::{exc}", file=sys.stderr)
    raise

payload = json.loads(os.environ["CAMOUFOX_OPTIONS_PAYLOAD"])
use_full_os_fonts = bool(payload.pop("use_full_os_fonts", False))
disable_default_addons = bool(payload.pop("disable_default_addons", False))

if isinstance(payload.get("screen"), dict):
    payload["screen"] = Screen(**payload["screen"])

if isinstance(payload.get("window"), list):
    payload["window"] = tuple(payload["window"])

if isinstance(payload.get("webgl_config"), list):
    payload["webgl_config"] = tuple(payload["webgl_config"])

if isinstance(payload.get("fingerprint"), dict):
    payload["fingerprint"] = Fingerprint(**payload["fingerprint"])

if isinstance(payload.get("exclude_addons"), list):
    payload["exclude_addons"] = [DefaultAddons[item] for item in payload["exclude_addons"]]

if disable_default_addons:
    current = payload.get("exclude_addons")
    existing = list(current) if isinstance(current, list) else []
    merged = []
    seen = set()
    for addon in [*existing, *list(DefaultAddons)]:
        key = addon.name if hasattr(addon, "name") else str(addon)
        if key in seen:
            continue
        seen.add(key)
        merged.append(addon)
    payload["exclude_addons"] = merged

if use_full_os_fonts:
    fonts_path = os.path.join(os.path.dirname(__import__("camoufox").__file__), "fonts.json")
    with open(fonts_path, "rb") as fonts_file:
        fonts_by_os = json.load(fonts_file)

    target_os = payload.get("os")
    if isinstance(target_os, list):
        target_os = next((item for item in target_os if isinstance(item, str)), None)
    os_key = {"windows": "win", "macos": "mac", "linux": "lin"}.get(target_os, OS_NAME)
    full_os_fonts = fonts_by_os.get(os_key, [])
    if isinstance(payload.get("fonts"), list):
        payload["fonts"] = list(dict.fromkeys([*full_os_fonts, *payload["fonts"]]))
    else:
        payload["fonts"] = full_os_fonts

options = launch_options(**payload)
print(json.dumps(options))
`;

export type CamoufoxProxyConfig = {
	server: string;
	username?: string;
	password?: string;
};

type PrimitiveEnvValue = string | number | boolean;
type JsonRecord = Record<string, unknown>;

type CamoufoxLaunchOptions = {
	args?: string[];
	env?: Record<string, string>;
	executablePath: string;
	firefoxUserPrefs?: Record<string, unknown>;
	headless?: boolean;
	proxy?: CamoufoxProxyConfig;
	[key: string]: unknown;
};

let cachedPythonBinary: string | null = null;
let cachedSystemFontFamilies: string[] | null = null;
let pendingSystemFontFamilies: Promise<string[]> | null = null;
const CAMOUFOX_HUMANIZE = true;
const CAMOUFOX_HUMANIZE_MAX_TIME_S = 1.5;

function isLocalAppMode(): boolean {
	return resolveAppMode(process.env.ONEGLANSE_APP_MODE) === "local";
}

function getHumanizeValue(): false | true | number {
	if (!CAMOUFOX_HUMANIZE) return false;
	const maxTime = CAMOUFOX_HUMANIZE_MAX_TIME_S;
	return maxTime > 0 ? maxTime : true;
}

function resolveHeadlessMode(
	override?: "virtual" | "headful" | "headless",
): "virtual" | "headful" | "headless" {
	return (
		override ??
		(process.env.CAMOUFOX_HEADLESS_MODE as
			| "virtual"
			| "headful"
			| "headless"
			| undefined) ??
		DEFAULT_CAMOUFOX_HEADLESS_MODE
	);
}

function getHeadlessValue(
	override?: "virtual" | "headful" | "headless",
): boolean {
	return resolveHeadlessMode(override) === "headless";
}

async function canUsePythonBinary(candidate: string): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync(
			candidate,
			["-c", PYTHON_PROBE_SCRIPT],
			{
				encoding: "utf8",
				timeout: PYTHON_PROBE_TIMEOUT_MS,
				maxBuffer: 32 * 1024,
			},
		);
		const parsed = JSON.parse(stdout) as {
			major?: number;
			minor?: number;
			version?: string;
		};
		return (
			typeof parsed.major === "number" &&
			typeof parsed.minor === "number" &&
			(parsed.major > 3 || (parsed.major === 3 && parsed.minor >= 10))
		);
	} catch {
		return false;
	}
}

async function resolvePythonBinary(provider: Provider): Promise<string> {
	if (cachedPythonBinary) return cachedPythonBinary;

	const candidates = [
		process.env.CAMOUFOX_PYTHON_BIN?.trim(),
		...PYTHON_CANDIDATES,
	].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of [...new Set(candidates)]) {
		if (await canUsePythonBinary(candidate)) {
			cachedPythonBinary = candidate;
			return candidate;
		}
	}

	throw new ExternalServiceError(
		provider,
		"Camoufox requires Python 3.10+ and the camoufox package. Set CAMOUFOX_PYTHON_BIN if python3 is not the correct interpreter.",
	);
}

function isJsonRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonValue<T>(
	name: string,
	raw: string | undefined,
): T | undefined {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as T;
	} catch (error) {
		throw new Error(
			`${name} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function parseJsonRecord(
	name: string,
	raw: string | undefined,
): JsonRecord | undefined {
	const parsed = parseJsonValue<unknown>(name, raw);
	if (parsed === undefined) return undefined;
	if (!isJsonRecord(parsed)) {
		throw new Error(`${name} must be a JSON object.`);
	}
	return parsed;
}

function parsePrimitiveRecord(
	name: string,
	raw: string | undefined,
): Record<string, PrimitiveEnvValue> | undefined {
	const parsed = parseJsonRecord(name, raw);
	if (!parsed) return undefined;

	const result: Record<string, PrimitiveEnvValue> = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (
			typeof value !== "string" &&
			typeof value !== "number" &&
			typeof value !== "boolean"
		) {
			throw new Error(`${name}.${key} must be a string, number, or boolean.`);
		}
		result[key] = value;
	}
	return result;
}

function toPrimitiveRecord(
	name: string,
	value: unknown,
): Record<string, PrimitiveEnvValue> | undefined {
	if (value === undefined) return undefined;
	if (!isJsonRecord(value)) {
		throw new Error(`${name} must be an object.`);
	}

	const result: Record<string, PrimitiveEnvValue> = {};
	for (const [key, item] of Object.entries(value)) {
		if (
			typeof item !== "string" &&
			typeof item !== "number" &&
			typeof item !== "boolean"
		) {
			throw new Error(`${name}.${key} must be a string, number, or boolean.`);
		}
		result[key] = item;
	}
	return result;
}

function parseStringList(
	name: string,
	raw: string | undefined,
): string[] | undefined {
	if (!raw) return undefined;

	const trimmed = raw.trim();
	if (!trimmed) return undefined;

	if (trimmed.startsWith("[")) {
		const parsed = parseJsonValue<unknown>(name, trimmed);
		if (
			!Array.isArray(parsed) ||
			parsed.some((item) => typeof item !== "string")
		) {
			throw new Error(`${name} must be a JSON array of strings.`);
		}
		return parsed.map((item) => item.trim()).filter(Boolean);
	}

	return trimmed
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseStringOrList(
	name: string,
	raw: string | undefined,
): string | string[] | undefined {
	const parsed = parseStringList(name, raw);
	if (!parsed || parsed.length === 0) return undefined;
	return parsed.length === 1 ? parsed[0] : parsed;
}

function parseStringPair(
	name: string,
	raw: string | undefined,
): [string, string] | undefined {
	if (!raw) return undefined;

	const parsed = parseJsonValue<unknown>(name, raw);
	if (
		!Array.isArray(parsed) ||
		parsed.length !== 2 ||
		parsed.some((item) => typeof item !== "string")
	) {
		throw new Error(`${name} must be a JSON array of two strings.`);
	}

	return [parsed[0], parsed[1]];
}

function parsePositiveInteger(
	name: string,
	raw: string | undefined,
): number | undefined {
	if (!raw) return undefined;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}
	return parsed;
}

function parseFingerprintPreset(
	raw: string | undefined,
): boolean | JsonRecord | undefined {
	if (!raw) return undefined;
	const normalized = raw.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;
	return parseJsonRecord("CAMOUFOX_FINGERPRINT_PRESET", raw);
}

function parseGeoipValue(): string | boolean | undefined {
	const raw = process.env.CAMOUFOX_GEOIP?.trim();
	if (!raw) {
		return true;
	}

	const normalized = raw.toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;
	return raw;
}

function normalizeFontFamilyName(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.replace(/^['"]|['"]$/g, "") || null;
}

function dedupeStrings(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseFontFamilyLines(raw: string): string[] {
	return dedupeStrings(
		raw
			.split(/\r?\n/)
			.flatMap((line) => line.split(","))
			.map((part) => normalizeFontFamilyName(part))
			.filter((value): value is string => Boolean(value)),
	);
}

async function listFontsWithFcList(): Promise<string[]> {
	const { stdout } = await execFileAsync("fc-list", ["--format=%{family}\\n"], {
		encoding: "utf8",
		timeout: SYSTEM_FONTS_TIMEOUT_MS,
		maxBuffer: 8 * 1024 * 1024,
	});
	return parseFontFamilyLines(stdout);
}

async function listFontsWithSystemProfiler(): Promise<string[]> {
	const { stdout } = await execFileAsync(
		"system_profiler",
		["SPFontsDataType", "-json"],
		{
			encoding: "utf8",
			timeout: SYSTEM_FONTS_TIMEOUT_MS,
			maxBuffer: 16 * 1024 * 1024,
		},
	);
	const parsed = JSON.parse(stdout) as {
		SPFontsDataType?: Array<{
			typefaces?: Array<{ family?: string }>;
		}>;
	};
	return dedupeStrings(
		(parsed.SPFontsDataType ?? [])
			.flatMap((entry) => entry.typefaces ?? [])
			.map((typeface) => normalizeFontFamilyName(typeface.family ?? ""))
			.filter((value): value is string => Boolean(value)),
	);
}

async function listFontsWithPowerShell(): Promise<string[]> {
	const script = [
		"Add-Type -AssemblyName System.Drawing",
		"$fonts = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }",
		"$fonts | ConvertTo-Json -Compress",
	].join("; ");
	const { stdout } = await execFileAsync(
		"powershell",
		["-NoProfile", "-Command", script],
		{
			encoding: "utf8",
			timeout: SYSTEM_FONTS_TIMEOUT_MS,
			maxBuffer: 4 * 1024 * 1024,
		},
	);
	const parsed = JSON.parse(stdout) as unknown;
	if (!Array.isArray(parsed)) return [];
	return dedupeStrings(
		parsed
			.map((value) =>
				typeof value === "string" ? normalizeFontFamilyName(value) : null,
			)
			.filter((value): value is string => Boolean(value)),
	);
}

async function discoverSystemFontFamilies(): Promise<string[]> {
	if (cachedSystemFontFamilies) {
		return cachedSystemFontFamilies;
	}
	if (pendingSystemFontFamilies) {
		return pendingSystemFontFamilies;
	}

	pendingSystemFontFamilies = (async () => {
		const resolvers: Array<() => Promise<string[]>> = [];
		if (process.platform === "win32") {
			resolvers.push(listFontsWithPowerShell);
		} else {
			resolvers.push(listFontsWithFcList);
			if (process.platform === "darwin") {
				resolvers.push(listFontsWithSystemProfiler);
			}
		}

		for (const resolveFonts of resolvers) {
			try {
				const fonts = await resolveFonts();
				if (fonts.length > 0) {
					cachedSystemFontFamilies = fonts;
					return fonts;
				}
			} catch {}
		}

		cachedSystemFontFamilies = [];
		return [];
	})().finally(() => {
		pendingSystemFontFamilies = null;
	});

	return pendingSystemFontFamilies;
}

function resolveHostOs(): "windows" | "macos" | "linux" | undefined {
	switch (process.platform) {
		case "win32":
			return "windows";
		case "darwin":
			return "macos";
		case "linux":
			return "linux";
		default:
			return undefined;
	}
}

function pickBrowserEnv(args?: {
	display?: string;
	headlessMode?: "virtual" | "headful" | "headless";
}): Record<string, PrimitiveEnvValue> {
	const baseEnv: Record<string, PrimitiveEnvValue> = {};

	for (const key of [
		"HOME",
		"PATH",
		"LANG",
		"LANGUAGE",
		"LC_ALL",
		"TZ",
		"TMPDIR",
		"TMP",
		"TEMP",
		"XAUTHORITY",
		"XDG_CACHE_HOME",
		"XDG_CONFIG_HOME",
		"XDG_RUNTIME_DIR",
		"LD_LIBRARY_PATH",
		"DBUS_SESSION_BUS_ADDRESS",
	]) {
		const value = process.env[key];
		if (value) {
			baseEnv[key] = value;
		}
	}

	if (args?.display) {
		baseEnv.DISPLAY = args.display;
	}

	return {
		...baseEnv,
		...(parsePrimitiveRecord(
			"CAMOUFOX_ENV_JSON",
			process.env.CAMOUFOX_ENV_JSON,
		) ?? {}),
	};
}

function stringifyEnv(
	input: Record<string, PrimitiveEnvValue | undefined> | undefined,
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(input ?? {})) {
		if (value === undefined) continue;
		result[key] = String(value);
	}
	return result;
}

async function buildLaunchPayload(args: {
	display?: string;
	proxy?: CamoufoxProxyConfig;
	headlessMode?: "virtual" | "headful" | "headless";
	humanize?: boolean;
	disableDefaultAddons?: boolean;
	disableFingerprinting?: boolean;
	plainAuthMode?: boolean;
}): Promise<Record<string, unknown>> {
	const extraLaunch = args.plainAuthMode
		? {}
		: args.disableFingerprinting
			? {}
			: (parseJsonRecord(
					"CAMOUFOX_EXTRA_LAUNCH_JSON",
					process.env.CAMOUFOX_EXTRA_LAUNCH_JSON,
				) ?? {});

	const extraArgs =
		Array.isArray(extraLaunch.args) &&
		extraLaunch.args.every((item) => typeof item === "string")
			? (extraLaunch.args as string[])
			: undefined;

	const payload: Record<string, unknown> = { ...extraLaunch };

	const config = {
		...(args.plainAuthMode
			? {}
			: {
					...(isJsonRecord(extraLaunch.config) ? extraLaunch.config : {}),
					...(parseJsonRecord(
						"CAMOUFOX_CONFIG_JSON",
						process.env.CAMOUFOX_CONFIG_JSON,
					) ?? {}),
				}),
		showcursor: false,
		...(args.plainAuthMode ? { disableTheming: true } : {}),
	};
	if (Object.keys(config).length > 0) payload.config = config;

	const firefoxUserPrefs = {
		...(args.plainAuthMode
			? {
					// Camoufox's patched Firefox binary may override prefers-color-scheme
					// at the pref level regardless of fingerprint settings. Setting this
					// to 2 (System) tells Firefox to follow the OS preference, which is
					// exactly what a real browser does. Without this, Google's sign-in
					// iframe renders with a white background when the binary default is
					// Light (1) but the user's OS is in dark mode.
					// Values: 0 = Dark, 1 = Light, 2 = System (follows OS)
					"layout.css.prefers-color-scheme.content-override": 2,
				}
			: {
					...(isJsonRecord(extraLaunch.firefox_user_prefs)
						? extraLaunch.firefox_user_prefs
						: {}),
					...(parseJsonRecord(
						"CAMOUFOX_FIREFOX_USER_PREFS_JSON",
						process.env.CAMOUFOX_FIREFOX_USER_PREFS_JSON,
					) ?? {}),
				}),
	};
	if (Object.keys(firefoxUserPrefs).length > 0) {
		payload.firefox_user_prefs = firefoxUserPrefs;
	}

	payload.env = {
		...(args.plainAuthMode
			? {}
			: (toPrimitiveRecord("CAMOUFOX_EXTRA_LAUNCH_JSON.env", extraLaunch.env) ??
				{})),
		...pickBrowserEnv({
			display: args.display,
			headlessMode: args.headlessMode,
		}),
	};

	const headlessMode = resolveHeadlessMode(args.headlessMode);
	payload.headless = getHeadlessValue(args.headlessMode);
	if (args.display && headlessMode === "virtual") {
		payload.virtual_display = args.display;
	}
	// Disable humanize in local mode and headful mode: the user can see the browser,
	// so camoufox's cursor animation serves no anti-detection purpose and just
	// triggers :hover states on every element the simulated cursor passes through.
	payload.humanize =
		isLocalAppMode() || headlessMode === "headful"
			? false
			: typeof args.humanize === "boolean"
				? args.humanize
				: getHumanizeValue();
	if (!args.plainAuthMode) {
		// Auth browser must never have these applied — they can break Google/OAuth
		// rendering (e.g. block_webgl breaks the sign-in widget, disable_coop breaks
		// the OAuth popup handshake). Runtime flow continues to read from env vars.
		payload.block_images = process.env.CAMOUFOX_BLOCK_IMAGES === "true";
		payload.block_webrtc = process.env.CAMOUFOX_BLOCK_WEBRTC === "true";
		payload.block_webgl = process.env.CAMOUFOX_BLOCK_WEBGL === "true";
		payload.disable_coop = process.env.CAMOUFOX_DISABLE_COOP === "true";
		payload.custom_fonts_only =
			process.env.CAMOUFOX_CUSTOM_FONTS_ONLY === "true";
		payload.main_world_eval = process.env.CAMOUFOX_MAIN_WORLD_EVAL === "true";
	}
	payload.enable_cache = process.env.CAMOUFOX_ENABLE_CACHE === "true";
	payload.i_know_what_im_doing =
		process.env.CAMOUFOX_I_KNOW_WHAT_IM_DOING === "true";
	payload.debug = process.env.CAMOUFOX_DEBUG === "true";

	if (args.proxy) {
		payload.proxy = args.proxy;
	} else {
		payload.proxy = undefined;
	}

	if (args.plainAuthMode || args.disableFingerprinting) {
		payload.geoip = false;
	} else if (!isLocalAppMode()) {
		const geoip = parseGeoipValue();
		if (geoip !== undefined) {
			payload.geoip = geoip;
		}
		if (process.env.CAMOUFOX_GEOIP_DB) {
			payload.geoip_db = process.env.CAMOUFOX_GEOIP_DB;
		}
	}

	const os = args.plainAuthMode
		? undefined
		: (parseStringOrList("CAMOUFOX_OS", process.env.CAMOUFOX_OS) ??
			(isLocalAppMode() && resolveHeadlessMode(args.headlessMode) === "headful"
				? resolveHostOs()
				: undefined));
	if (os !== undefined) payload.os = os;

	// GeoIP handles timezone/location fingerprint — locale is always en-US so
	// the browser renders in English regardless of the proxy exit country.
	// Override with CAMOUFOX_LOCALE env var if needed.
	const locale = args.plainAuthMode
		? "en-US"
		: (parseStringOrList("CAMOUFOX_LOCALE", process.env.CAMOUFOX_LOCALE) ??
			"en-US");
	payload.locale = locale;

	const addons = args.plainAuthMode
		? undefined
		: parseStringList("CAMOUFOX_ADDONS", process.env.CAMOUFOX_ADDONS);
	if (addons !== undefined) payload.addons = addons;

	const fonts = args.plainAuthMode
		? undefined
		: parseStringList("CAMOUFOX_FONTS", process.env.CAMOUFOX_FONTS);
	const systemFonts =
		!args.plainAuthMode && process.env.CAMOUFOX_USE_FULL_OS_FONTS === "true"
			? await discoverSystemFontFamilies()
			: [];
	const mergedFonts = dedupeStrings([...(fonts ?? []), ...systemFonts]);
	if (mergedFonts.length > 0) payload.fonts = mergedFonts;
	if (!args.plainAuthMode) {
		payload.use_full_os_fonts =
			process.env.CAMOUFOX_USE_FULL_OS_FONTS === "true";
	}
	if (args.disableDefaultAddons) {
		payload.disable_default_addons = true;
	}

	const excludeAddons = args.plainAuthMode
		? undefined
		: parseStringList(
				"CAMOUFOX_EXCLUDE_ADDONS",
				process.env.CAMOUFOX_EXCLUDE_ADDONS,
			)?.map((value) => value.toUpperCase());
	if (excludeAddons !== undefined) payload.exclude_addons = excludeAddons;

	const webglConfig = args.plainAuthMode
		? undefined
		: parseStringPair(
				"CAMOUFOX_WEBGL_CONFIG",
				process.env.CAMOUFOX_WEBGL_CONFIG,
			);
	if (webglConfig !== undefined) payload.webgl_config = webglConfig;

	const ffVersion = args.plainAuthMode
		? undefined
		: parsePositiveInteger(
				"CAMOUFOX_FF_VERSION",
				process.env.CAMOUFOX_FF_VERSION,
			);
	if (ffVersion !== undefined) payload.ff_version = ffVersion;

	if (args.plainAuthMode || args.disableFingerprinting) {
		payload.fingerprint_preset = false;
		payload.fingerprint = undefined;
	} else {
		const fingerprint =
			parseJsonRecord(
				"CAMOUFOX_FINGERPRINT_JSON",
				process.env.CAMOUFOX_FINGERPRINT_JSON,
			) ??
			(isJsonRecord(extraLaunch.fingerprint)
				? extraLaunch.fingerprint
				: undefined);
		if (fingerprint !== undefined) payload.fingerprint = fingerprint;

		const fingerprintPreset = parseFingerprintPreset(
			process.env.CAMOUFOX_FINGERPRINT_PRESET,
		);
		if (fingerprintPreset !== undefined) {
			payload.fingerprint_preset = fingerprintPreset;
		}
	}

	const argsList = args.plainAuthMode
		? undefined
		: (parseStringList("CAMOUFOX_ARGS", process.env.CAMOUFOX_ARGS) ??
			extraArgs);
	if (argsList !== undefined) payload.args = argsList;

	if (process.env.CAMOUFOX_BROWSER) {
		payload.browser = process.env.CAMOUFOX_BROWSER;
	}
	if (process.env.CAMOUFOX_EXECUTABLE_PATH) {
		payload.executable_path = process.env.CAMOUFOX_EXECUTABLE_PATH;
	}

	for (const key of Object.keys(payload)) {
		const value = payload[key];
		if (
			value === undefined ||
			(isJsonRecord(value) && Object.keys(value).length === 0) ||
			(Array.isArray(value) && value.length === 0)
		) {
			delete payload[key];
		}
	}

	return payload;
}

export async function resolveCamoufoxLaunchOptions(args: {
	display?: string;
	provider: Provider;
	proxy?: CamoufoxProxyConfig;
	headlessMode?: "virtual" | "headful" | "headless";
	humanize?: boolean;
	disableDefaultAddons?: boolean;
	disableFingerprinting?: boolean;
	plainAuthMode?: boolean;
}): Promise<CamoufoxLaunchOptions> {
	const python = await resolvePythonBinary(args.provider);
	const payload = await buildLaunchPayload(args);
	const childEnv = {
		...process.env,
		...(args.display ? { DISPLAY: args.display } : {}),
		CAMOUFOX_OPTIONS_PAYLOAD: JSON.stringify(payload),
	};

	try {
		const { stdout } = await execFileAsync(
			python,
			["-c", CAMOUFOX_OPTIONS_SCRIPT],
			{
				encoding: "utf8",
				env: childEnv,
				timeout: CAMOUFOX_OPTIONS_TIMEOUT_MS,
				maxBuffer: 512 * 1024,
			},
		);
		const lines = stdout.trim().split("\n");
		const jsonLine =
			[...lines].reverse().find((l) => l.trimStart().startsWith("{")) ??
			stdout.trim();
		const parsed = JSON.parse(jsonLine) as {
			args?: string[];
			env?: Record<string, PrimitiveEnvValue>;
			executable_path?: string;
			firefox_user_prefs?: Record<string, unknown>;
			headless?: boolean;
			proxy?: CamoufoxProxyConfig;
			[key: string]: unknown;
		};

		if (!parsed.executable_path) {
			throw new Error("Camoufox did not return an executable path.");
		}

		const {
			executable_path: executablePath,
			firefox_user_prefs: firefoxUserPrefs,
			...rest
		} = parsed;

		return {
			...rest,
			args: parsed.args ?? [],
			env: stringifyEnv(parsed.env),
			executablePath,
			firefoxUserPrefs: firefoxUserPrefs ?? {},
			headless: parsed.headless ?? false,
			proxy: parsed.proxy,
		};
	} catch (error) {
		const stderr =
			typeof (error as { stderr?: unknown })?.stderr === "string"
				? (error as { stderr: string }).stderr.trim()
				: "";
		const message = stderr || toErrorMessage(error);
		const installHint =
			"Install Camoufox in the runtime image, for example: python3 -m pip install 'cloverlabs-camoufox[geoip]' && python3 -m camoufox set official/stable && python3 -m camoufox fetch";
		throw new ExternalServiceError(
			args.provider,
			message.includes("CAMOUFOX_IMPORT_ERROR::")
				? `Camoufox is not installed for ${python}. ${installHint}`
				: `Failed to resolve Camoufox launch options: ${message}`,
		);
	}
}
