import type { Provider } from "@oneglanse/types";

export const PROVIDER_NO_OUTPUT_TIMEOUT_MS: Record<Provider, number> = {
	chatgpt: 90_000,
	perplexity: 45_000,
	gemini: 45_000,
};

export const PROVIDER_FORCE_EXIT_STABLE_MS: Record<Provider, number> = {
	chatgpt: 45_000,
	perplexity: 30_000,
	gemini: 45_000,
};

// Provider-specific editor selectors used for health checks (most reliable first).
// Keyed by provider so callers only test selectors relevant to the current session,
// avoiding false positives and unnecessary timeout ticks on unrelated selectors.
export const PROVIDER_EDITOR_SELECTORS: Record<Provider, string[]> = {
	chatgpt: ["#prompt-textarea", 'div#prompt-textarea[contenteditable="true"]'],
	perplexity: [
		'#ask-input[contenteditable="true"]',
		'[data-lexical-editor="true"][contenteditable="true"]',
	],
	gemini: [
		'[aria-label="Enter a prompt for Gemini"][contenteditable="true"]',
		'div.ql-editor[contenteditable="true"]',
	],
};

export const PROVIDER_SUBMIT_BTN_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
		'button[data-testid="send-button"]',
		'button[aria-label="Send prompt"]',
		'button[aria-label*="send" i]',
		'button[type="submit"]',
	],
	perplexity: [
		'button[aria-label="Submit"]',
		'button[aria-label*="submit" i]',
		'button[type="submit"]',
	],
	gemini: [
		'button[aria-label="Send message"]',
		"button.send-button",
		'button[aria-label*="send" i]',
		'button[type="submit"]',
	],
};

export const PROVIDER_MODEL_RESPONSE_SELECTORS: Record<Provider, string[]> = {
	chatgpt: ['[data-message-author-role="assistant"]'],
	perplexity: [".prose"],
	gemini: ["model-response"],
};

export const PROVIDER_RESPONSE_GENERATION_SELECTORS: Record<
	Provider,
	string[]
> = {
	chatgpt: [
		'button[data-testid="stop-button"]',
		'button[aria-label="Stop streaming"]',
		'button[aria-label*="stop" i]',
		".loading-shimmer",
	],
	perplexity: [
		'button[aria-label="Stop response (Esc)"]',
		'button[aria-label*="stop" i]',
	],
	gemini: [
		'button[aria-label="Stop response"]',
		'button[aria-label*="stop" i]',
	],
};

export const SOURCES_SELECTORS = [
	// ARIA-driven (ChatGPT, Perplexity)
	'button[aria-label*="source" i]',
	'button[aria-label*="citation" i]',
	'[role="button"][aria-label*="source" i]',
	'[role="button"][aria-label*="citation" i]',

	// Data-testid
	'[data-testid*="source" i]',
	'[data-testid*="citation" i]',
];

export const RETRYABLE_ERRORS = [
	"ERR_SSL_PROTOCOL_ERROR",
	"ERR_CONNECTION",
	"ERR_TIMED_OUT",
	"ERR_PROXY_CONNECTION_FAILED",
	"Timeout",
];
