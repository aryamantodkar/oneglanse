import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ExternalServiceError, toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { env } from "../../env.js";

const execFileAsync = promisify(execFile);
const PYTHON_CANDIDATES = ["python3.12", "python3.11", "python3.10", "python3"];
const PYTHON_PROBE_TIMEOUT_MS = 5_000;
const CAMOUFOX_OPTIONS_TIMEOUT_MS = 30_000;

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
    from camoufox.utils import launch_options
except Exception as exc:
    print(f"CAMOUFOX_IMPORT_ERROR::{exc}", file=sys.stderr)
    raise

payload = json.loads(os.environ["CAMOUFOX_OPTIONS_PAYLOAD"])

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
type CamoufoxScreen = {
	min_width?: number;
	max_width?: number;
	min_height?: number;
	max_height?: number;
};

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

function getHumanizeValue(): false | true | number {
	if (!env.CAMOUFOX_HUMANIZE) return false;
	const maxTime = env.CAMOUFOX_HUMANIZE_MAX_TIME_S;
	return maxTime > 0 ? maxTime : true;
}

function getHeadlessValue(): boolean {
	return env.CAMOUFOX_HEADLESS_MODE === "headless";
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
		env.CAMOUFOX_PYTHON_BIN?.trim(),
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

function parseJsonValue<T>(name: string, raw: string | undefined): T | undefined {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as T;
	} catch (error) {
		throw new Error(
			`${name} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function parseJsonRecord(name: string, raw: string | undefined): JsonRecord | undefined {
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

function parseStringList(name: string, raw: string | undefined): string[] | undefined {
	if (!raw) return undefined;

	const trimmed = raw.trim();
	if (!trimmed) return undefined;

	if (trimmed.startsWith("[")) {
		const parsed = parseJsonValue<unknown>(name, trimmed);
		if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
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

function parseNumberPair(
	name: string,
	raw: string | undefined,
): [number, number] | undefined {
	if (!raw) return undefined;

	const trimmed = raw.trim();
	if (!trimmed) return undefined;

	if (trimmed.startsWith("[")) {
		const parsed = parseJsonValue<unknown>(name, trimmed);
		if (
			!Array.isArray(parsed) ||
			parsed.length !== 2 ||
			parsed.some((item) => typeof item !== "number" || !Number.isFinite(item))
		) {
			throw new Error(`${name} must be a JSON array of two numbers.`);
		}
		return [parsed[0], parsed[1]];
	}

	const match = trimmed.match(/^(\d+)\s*[x,]\s*(\d+)$/i);
	if (!match) {
		throw new Error(`${name} must be JSON [width,height] or WIDTHxHEIGHT.`);
	}

	return [Number(match[1]), Number(match[2])];
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

function parseScreenConstraints(raw: string | undefined): CamoufoxScreen | undefined {
	const parsed = parseJsonRecord("CAMOUFOX_SCREEN", raw);
	if (!parsed) return undefined;

	const result: CamoufoxScreen = {};
	for (const key of ["min_width", "max_width", "min_height", "max_height"] as const) {
		const value = parsed[key];
		if (value === undefined) continue;
		if (typeof value !== "number" || !Number.isFinite(value)) {
			throw new Error(`CAMOUFOX_SCREEN.${key} must be a number.`);
		}
		result[key] = value;
	}
	return result;
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
	const raw = env.CAMOUFOX_GEOIP?.trim();
	if (!raw) {
		return true;
	}

	const normalized = raw.toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;
	return raw;
}

function pickBrowserEnv(display?: string): Record<string, PrimitiveEnvValue> {
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

	if (display) {
		baseEnv.DISPLAY = display;
	}

	return {
		...baseEnv,
		...(parsePrimitiveRecord("CAMOUFOX_ENV_JSON", env.CAMOUFOX_ENV_JSON) ?? {}),
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

function buildLaunchPayload(args: {
	display?: string;
	proxy?: CamoufoxProxyConfig;
}): Record<string, unknown> {
	const extraLaunch =
		parseJsonRecord("CAMOUFOX_EXTRA_LAUNCH_JSON", env.CAMOUFOX_EXTRA_LAUNCH_JSON) ??
		{};

	const extraArgs =
		Array.isArray(extraLaunch.args) &&
		extraLaunch.args.every((item) => typeof item === "string")
			? (extraLaunch.args as string[])
			: undefined;

	const payload: Record<string, unknown> = { ...extraLaunch };

	const config = {
		...(isJsonRecord(extraLaunch.config) ? extraLaunch.config : {}),
		...(parseJsonRecord("CAMOUFOX_CONFIG_JSON", env.CAMOUFOX_CONFIG_JSON) ?? {}),
	};
	if (Object.keys(config).length > 0) payload.config = config;

	const firefoxUserPrefs = {
		...(isJsonRecord(extraLaunch.firefox_user_prefs)
			? extraLaunch.firefox_user_prefs
			: {}),
		...(parseJsonRecord(
			"CAMOUFOX_FIREFOX_USER_PREFS_JSON",
			env.CAMOUFOX_FIREFOX_USER_PREFS_JSON,
		) ?? {}),
	};
	if (Object.keys(firefoxUserPrefs).length > 0) {
		payload.firefox_user_prefs = firefoxUserPrefs;
	}

	payload.env = {
		...(toPrimitiveRecord("CAMOUFOX_EXTRA_LAUNCH_JSON.env", extraLaunch.env) ?? {}),
		...pickBrowserEnv(args.display),
	};

	payload.headless = getHeadlessValue();
	if (args.display && env.CAMOUFOX_HEADLESS_MODE === "virtual") {
		payload.virtual_display = args.display;
	}
	payload.humanize = getHumanizeValue();
	payload.block_images = env.CAMOUFOX_BLOCK_IMAGES;
	payload.block_webrtc = env.CAMOUFOX_BLOCK_WEBRTC;
	payload.block_webgl = env.CAMOUFOX_BLOCK_WEBGL;
	payload.disable_coop = env.CAMOUFOX_DISABLE_COOP;
	payload.custom_fonts_only = env.CAMOUFOX_CUSTOM_FONTS_ONLY;
	payload.main_world_eval = env.CAMOUFOX_MAIN_WORLD_EVAL;
	payload.enable_cache = env.CAMOUFOX_ENABLE_CACHE;
	payload.i_know_what_im_doing = env.CAMOUFOX_I_KNOW_WHAT_IM_DOING;
	payload.debug = env.CAMOUFOX_DEBUG;

	if (args.proxy) {
		payload.proxy = args.proxy;
	} else {
		delete payload.proxy;
	}

	const geoip = parseGeoipValue();
	if (geoip !== undefined) {
		// When geoip=true (default), camoufox calls ipecho.net through the proxy to discover
		// the proxy's public IP for GeoIP lookup. Residential/datacenter proxies commonly
		// block or SSL-strip this HTTPS request, causing a hard launch failure.
		// Fix: extract the proxy IP directly and pass it as the geoip value — camoufox
		// accepts an IP string and uses it for local MaxMind lookup without any network call.
		if (geoip === true && args.proxy?.server) {
			try {
				const { hostname } = new URL(args.proxy.server);
				const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
				payload.geoip = isIpv4 ? hostname : geoip;
			} catch {
				payload.geoip = geoip;
			}
		} else {
			payload.geoip = geoip;
		}
	}
	if (env.CAMOUFOX_GEOIP_DB) payload.geoip_db = env.CAMOUFOX_GEOIP_DB;

	// Default to Windows + macOS only — Linux desktop is ~2-5% market share and
	// heavily scrutinised by bot detection. Override with CAMOUFOX_OS if needed.
	payload.os = parseStringOrList("CAMOUFOX_OS", env.CAMOUFOX_OS) ?? ["windows", "macos"];

	// Let camoufox derive locale from geoip by default — it picks the correct
	// locale for the proxy's exit country, keeping locale/timezone/IP coherent.
	// Only override via CAMOUFOX_LOCALE if you know all exit IPs share a region.
	const locale = parseStringOrList("CAMOUFOX_LOCALE", env.CAMOUFOX_LOCALE);
	if (locale !== undefined) payload.locale = locale;

	const addons = parseStringList("CAMOUFOX_ADDONS", env.CAMOUFOX_ADDONS);
	if (addons !== undefined) payload.addons = addons;

	const fonts = parseStringList("CAMOUFOX_FONTS", env.CAMOUFOX_FONTS);
	if (fonts !== undefined) payload.fonts = fonts;

	const excludeAddons = parseStringList(
		"CAMOUFOX_EXCLUDE_ADDONS",
		env.CAMOUFOX_EXCLUDE_ADDONS,
	)?.map((value) => value.toUpperCase());
	if (excludeAddons !== undefined) payload.exclude_addons = excludeAddons;

	// Constrain screen to real-world resolutions by default. Without constraints
	// BrowserForge can generate a screen smaller than the viewport — physically
	// impossible and a fingerprinting signal. Override with CAMOUFOX_SCREEN if needed.
	payload.screen = parseScreenConstraints(env.CAMOUFOX_SCREEN) ?? {
		min_width: 1366,
		max_width: 1920,
		min_height: 768,
		max_height: 1080,
	};

	const window = parseNumberPair("CAMOUFOX_WINDOW", env.CAMOUFOX_WINDOW);
	if (window !== undefined) payload.window = window;

	const webglConfig = parseStringPair(
		"CAMOUFOX_WEBGL_CONFIG",
		env.CAMOUFOX_WEBGL_CONFIG,
	);
	if (webglConfig !== undefined) payload.webgl_config = webglConfig;

	const ffVersion = parsePositiveInteger(
		"CAMOUFOX_FF_VERSION",
		env.CAMOUFOX_FF_VERSION,
	);
	if (ffVersion !== undefined) payload.ff_version = ffVersion;

	const fingerprint =
		parseJsonRecord("CAMOUFOX_FINGERPRINT_JSON", env.CAMOUFOX_FINGERPRINT_JSON) ??
		(isJsonRecord(extraLaunch.fingerprint) ? extraLaunch.fingerprint : undefined);
	if (fingerprint !== undefined) payload.fingerprint = fingerprint;

	// Use real device capture data by default — more coherent attribute bundles
	// (canvas, fonts, audio, plugins) than synthetic generation.
	payload.fingerprint_preset = parseFingerprintPreset(env.CAMOUFOX_FINGERPRINT_PRESET) ?? true;

	const argsList = parseStringList("CAMOUFOX_ARGS", env.CAMOUFOX_ARGS) ?? extraArgs;
	if (argsList !== undefined) payload.args = argsList;

	if (env.CAMOUFOX_BROWSER) payload.browser = env.CAMOUFOX_BROWSER;
	if (env.CAMOUFOX_EXECUTABLE_PATH) {
		payload.executable_path = env.CAMOUFOX_EXECUTABLE_PATH;
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
}): Promise<CamoufoxLaunchOptions> {
	const python = await resolvePythonBinary(args.provider);
	const payload = buildLaunchPayload(args);
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
		const jsonLine = [...lines].reverse().find((l) => l.trimStart().startsWith("{")) ?? stdout.trim();
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
			"Install Camoufox in the runtime image, for example: python3 -m pip install 'cloverlabs-camoufox[geoip]' && python3 -m camoufox set official/prerelease && python3 -m camoufox fetch";
		throw new ExternalServiceError(
			args.provider,
			message.includes("CAMOUFOX_IMPORT_ERROR::")
				? `Camoufox is not installed for ${python}. ${installHint}`
				: `Failed to resolve Camoufox launch options: ${message}`,
		);
	}
}
