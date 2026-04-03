import fs from "node:fs";
import { APP_MODE_LIST } from "@oneglanse/types";
import dotenv from "dotenv";
import { z } from "zod";

const ROOT_ENV_FALLBACK_KEYS = [
	"DATABASE_URL",
	"OPENAI_API_KEY",
	"AGENT_AUTH_UPLOAD_TOKEN",
	"REDIS_HOST",
	"REDIS_PORT",
	"REDIS_PASSWORD",
] as const;

function loadRootEnvFallbacks(): void {
	if (!fs.existsSync(".env")) {
		return;
	}

	const parsed = dotenv.parse(fs.readFileSync(".env"));
	for (const key of ROOT_ENV_FALLBACK_KEYS) {
		const value = parsed[key];
		if (value && !process.env[key]) {
			process.env[key] = value;
		}
	}
}

if (process.env.NODE_ENV !== "production") {
	loadRootEnvFallbacks();
	if (fs.existsSync("apps/agent/.env")) {
		dotenv.config({ path: "apps/agent/.env", override: true });
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
		ONEGLANSE_APP_MODE: z.enum(APP_MODE_LIST).default("local"),
		AGENT_AUTH_UPLOAD_TOKEN: z.string().trim().optional(),
		DEBUG_ENABLED: asBoolean(false).default(false),
		PROXY_SCHEME: z.enum(["http", "https", "socks4", "socks5"]).optional(),
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
		REDIS_HOST: z.string().trim().default("redis"),
		REDIS_PORT: asNumber(6379).default(6379),
		REDIS_PASSWORD: z.string().min(1),
	})
	.superRefine((values, ctx) => {
		const hasProxyScheme = Boolean(values.PROXY_SCHEME);
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
		if (hasProxyScheme && values.PROXY_PROVIDER !== "thordata") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["PROXY_SCHEME"],
				message:
					"Only ThorData proxy config is supported through the typed agent env.",
			});
		}
	});

export const env = AgentEnvSchema.parse(process.env);
