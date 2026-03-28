import fs from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
	if (fs.existsSync("apps/agent/.env")) {
		dotenv.config({ path: "apps/agent/.env" });
	} else if (fs.existsSync(".env")) {
		dotenv.config();
	}
}

const asNumber = (fallback: number) =>
	z.preprocess((value) => {
		if (typeof value === "number") return value;
		if (typeof value !== "string") return fallback;
		const trimmed = value.trim();
		if (!trimmed) return fallback;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : fallback;
	}, z.number());

const asBoolean = (fallback = false) =>
	z.preprocess((value) => {
		if (typeof value === "boolean") return value;
		if (typeof value !== "string") return fallback;
		const normalized = value.trim().toLowerCase();
		if (!normalized) return fallback;
		return normalized === "true" || normalized === "1";
	}, z.boolean());

const AgentEnvSchema = z
	.object({
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		DEBUG_ENABLED: asBoolean(false).default(false),
		MIN_RESPONSE_CHARS: asNumber(600).default(600),
		STEP_EXECUTION_TIMEOUT_MS: asNumber(180_000).default(180_000),
		PAGE_DEFAULT_TIMEOUT_MS: asNumber(30_000).default(30_000),
		PAGE_DEFAULT_NAVIGATION_TIMEOUT_MS: asNumber(60_000).default(60_000),
		PROVIDER_HOOK_TIMEOUT_MS: asNumber(20_000).default(20_000),
		MAX_EXTRACTION_RETRIES: asNumber(2).default(2),
		EXTRACTION_RETRY_DELAY_MS: asNumber(2_000).default(2_000),
		MAX_EXTRACTION_RETRY_DELAY_MS: asNumber(5_000).default(5_000),
		AI_OVERVIEW_WAIT_TIMEOUT_MS: asNumber(25_000).default(25_000),
		SUBMIT_METHOD_TIMEOUT_MS: asNumber(5_000).default(5_000),
		MAX_PROMPT_RETRIES_PER_IP: asNumber(3).default(3),
		PROMPT_RETRY_DELAY_MS: asNumber(1_000).default(1_000),
		MAX_PROMPT_RETRY_DELAY_MS: asNumber(5_000).default(5_000),
		SUBMISSION_PHASE_TIMEOUT_MS: asNumber(15_000).default(15_000),
		PROXY_SCHEME: z.enum(["http", "https", "socks4", "socks5"]).optional(),
		PROXY_HOST: z.string().trim().optional(),
		PROXY_PORT: z.string().trim().optional(),
		PROXY_USERNAME: z.string().trim().optional(),
		PROXY_PASSWORD: z.string().trim().optional(),
		THORDATA_PROXY_API_URL: z.string().trim().url().optional(),
		PROXY_PROVIDER: z
			.preprocess(
				(value) =>
					typeof value === "string" ? value.trim().toLowerCase() : undefined,
				z
					.enum([
						"generic",
						"brightdata",
						"decodo",
						"iproyal",
						"lunaproxy",
						"netnut",
						"oxylabs",
						"proxyempire",
						"scrapeops",
						"smartproxy",
						"soax",
						"thordata",
						"webshare",
					])
					.optional(),
			)
			.optional(),
		CAMOUFOX_PYTHON_BIN: z.string().trim().optional(),
		CAMOUFOX_HEADLESS_MODE: z
			.enum(["virtual", "headful", "headless"])
			.default("virtual"),
		CAMOUFOX_HUMANIZE: asBoolean(true).default(true),
		CAMOUFOX_HUMANIZE_MAX_TIME_S: asNumber(1.5).default(1.5),
		CAMOUFOX_GEOIP: z.string().trim().optional(),
		CAMOUFOX_GEOIP_DB: z.string().trim().optional(),
		CAMOUFOX_OS: z.string().trim().optional(),
		CAMOUFOX_LOCALE: z.string().trim().optional(),
		CAMOUFOX_FONTS: z.string().trim().optional(),
		CAMOUFOX_ADDONS: z.string().trim().optional(),
		CAMOUFOX_EXCLUDE_ADDONS: z.string().trim().optional(),
		CAMOUFOX_WINDOW: z.string().trim().optional(),
		CAMOUFOX_SCREEN: z.string().trim().optional(),
		CAMOUFOX_WEBGL_CONFIG: z.string().trim().optional(),
		CAMOUFOX_BROWSER: z.string().trim().optional(),
		CAMOUFOX_FF_VERSION: z.string().trim().optional(),
		CAMOUFOX_CONFIG_JSON: z.string().trim().optional(),
		CAMOUFOX_FINGERPRINT_JSON: z.string().trim().optional(),
		CAMOUFOX_EXTRA_LAUNCH_JSON: z.string().trim().optional(),
		CAMOUFOX_FIREFOX_USER_PREFS_JSON: z.string().trim().optional(),
		CAMOUFOX_ENV_JSON: z.string().trim().optional(),
		CAMOUFOX_ARGS: z.string().trim().optional(),
		CAMOUFOX_EXECUTABLE_PATH: z.string().trim().optional(),
		CAMOUFOX_FINGERPRINT_PRESET: z.string().trim().optional(),
		CAMOUFOX_MAIN_WORLD_EVAL: asBoolean(false).default(false),
		CAMOUFOX_ENABLE_CACHE: asBoolean(false).default(false),
		CAMOUFOX_BLOCK_IMAGES: asBoolean(false).default(false),
		CAMOUFOX_BLOCK_WEBRTC: asBoolean(false).default(false),
		CAMOUFOX_BLOCK_WEBGL: asBoolean(false).default(false),
		CAMOUFOX_DISABLE_COOP: asBoolean(false).default(false),
		CAMOUFOX_CUSTOM_FONTS_ONLY: asBoolean(false).default(false),
		CAMOUFOX_I_KNOW_WHAT_IM_DOING: asBoolean(false).default(false),
		CAMOUFOX_DEBUG: asBoolean(false).default(false),
		CAMOUFOX_XVFB_DISPLAY: z.string().trim().optional(),
		CAMOUFOX_XVFB_SCREEN: z.string().trim().optional(),
		REDIS_HOST: z.string().trim().default("redis"),
		REDIS_PORT: asNumber(6379).default(6379),
		REDIS_PASSWORD: z.string().min(1),
	})
	.superRefine((values, ctx) => {
		const hasProxyScheme = Boolean(values.PROXY_SCHEME);
		const hasProxyHost = Boolean(values.PROXY_HOST);
		const hasProxyPort = Boolean(values.PROXY_PORT);
		const hasProxyUser = Boolean(values.PROXY_USERNAME);
		const hasProxyPass = Boolean(values.PROXY_PASSWORD);
		const usesThorDataApi =
			values.PROXY_PROVIDER === "thordata" &&
			Boolean(values.THORDATA_PROXY_API_URL);

		if (values.THORDATA_PROXY_API_URL && values.PROXY_PROVIDER !== "thordata") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["THORDATA_PROXY_API_URL"],
				message:
					"THORDATA_PROXY_API_URL can only be used when PROXY_PROVIDER=thordata.",
			});
		}

		if (usesThorDataApi) {
			return;
		}

		if (hasProxyHost !== hasProxyPort) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["PROXY_HOST"],
				message: "PROXY_HOST and PROXY_PORT must be set together.",
			});
		}

		if (hasProxyPort) {
			const parsedPort = Number(values.PROXY_PORT);
			const validPort =
				Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;
			if (!validPort) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["PROXY_PORT"],
					message: "PROXY_PORT must be an integer between 1 and 65535.",
				});
			}
		}

		if (hasProxyUser !== hasProxyPass) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["PROXY_USERNAME"],
				message: "PROXY_USERNAME and PROXY_PASSWORD must be set together.",
			});
		}

		if ((hasProxyUser || hasProxyPass) && !(hasProxyHost && hasProxyPort)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["PROXY_HOST"],
				message:
					"PROXY_HOST and PROXY_PORT are required when proxy credentials are set.",
			});
		}

		if (hasProxyScheme && !(hasProxyHost && hasProxyPort)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["PROXY_SCHEME"],
				message: "PROXY_SCHEME requires PROXY_HOST and PROXY_PORT.",
			});
		}

		if (values.PROXY_PROVIDER && !(hasProxyHost && hasProxyPort)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["PROXY_PROVIDER"],
				message: "PROXY_PROVIDER requires PROXY_HOST and PROXY_PORT.",
			});
		}
	});

export const env = AgentEnvSchema.parse(process.env);
