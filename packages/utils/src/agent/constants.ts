import type { Provider } from "@oneglanse/types";


// If no output renders within this window, the page is broken or logged out.
export const NO_OUTPUT_TIMEOUT_MS = 30_000;

// If text hasn't changed for this long but the generating indicator is still showing,
// the model is stuck — force exit rather than waiting indefinitely.
export const FORCE_EXIT_STABLE_MS = 20_000;


// Provider-specific editor selectors used for health checks (most reliable first).
// Keyed by provider so callers only test selectors relevant to the current session,
// avoiding false positives and unnecessary timeout ticks on unrelated selectors.
export const PROVIDER_EDITOR_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
		"#prompt-textarea",
		'div#prompt-textarea[contenteditable="true"]',
		'textarea[name="prompt-textarea"]',
	],
	perplexity: [
		'#ask-input[contenteditable="true"]',
		'[data-lexical-editor="true"][contenteditable="true"]',
		'div[contenteditable="true"][spellcheck="true"]',
	],
	gemini: [
		'[aria-label="Enter a prompt for Gemini"][contenteditable="true"]',
		'div.ql-editor[contenteditable="true"]',
		'rich-textarea [contenteditable="true"]',
		'[role="textbox"][contenteditable="true"]',
	],
	"ai-overview": [
		'textarea[name="q"]',
		'textarea[name="q"][role="combobox"]',
		'input[name="q"]',
		'textarea[aria-label="Search"]',
		'input[aria-label="Search"]',
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
		'button.send-button',
		'button[aria-label*="send" i]',
		'button[type="submit"]',
	],
	"ai-overview": [
		'button[aria-label="Search"]',
		'input[name="btnK"]',
		'input[type="submit"][value="Google Search"]',
		'input[aria-label="Google Search"]',
		'input[name="btnI"]',
		'input[type="submit"][value="I\'m Feeling Lucky"]',
		'button[type="submit"]',
	],
};

export const PROVIDER_MODEL_RESPONSE_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
		'[data-message-author-role="assistant"]',
		'.prose',
		'article[data-testid*="conversation-turn"]',
	],
	perplexity: [
		'.prose',
	],
	gemini: [
		'message-content',
		'.model-response-text',
		'model-response',
	],
	"ai-overview": [
		'[data-container-id="model-response-placeholder"] [data-container-id="main-col"]',
		'[role="region"] .markdown-content',
	],
};

export const PROVIDER_RESPONSE_GENERATION_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
		'button[data-testid="stop-button"]',
		'button[aria-label="Stop streaming"]',
		'button[aria-label*="stop" i]',
		'.loading-shimmer',
	],
	perplexity: [
		'button[aria-label="Stop response (Esc)"]',
		'button[aria-label*="stop" i]',
	],
	gemini: [
		'button[aria-label="Stop response"]',
		'button[aria-label*="stop" i]',
	],
	"ai-overview": [],
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
