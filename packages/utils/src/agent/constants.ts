import type { Provider } from "@oneglanse/types";

export const PROVIDER_NO_OUTPUT_TIMEOUT_MS: Record<Provider, number> = {
	chatgpt: 90_000,
	perplexity: 45_000,
	gemini: 45_000,
	claude: 60_000,
	"ai-overview": 45_000,
};

export const PROVIDER_FORCE_EXIT_STABLE_MS: Record<Provider, number> = {
	chatgpt: 45_000,
	perplexity: 30_000,
	gemini: 45_000,
	claude: 45_000,
	"ai-overview": 30_000,
};

export const RETRYABLE_ERRORS = [
	"ERR_SSL_PROTOCOL_ERROR",
	"ERR_CONNECTION",
	"ERR_TIMED_OUT",
	"ERR_PROXY_CONNECTION_FAILED",
	"Timeout",
];
