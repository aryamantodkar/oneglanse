import type { Provider } from "@oneglanse/types";


// If no output renders within this window, the page is broken or logged out.
export const NO_OUTPUT_TIMEOUT_MS = 45_000;

// If text hasn't changed for this long but the generating indicator is still showing,
// the model is stuck — force exit rather than waiting indefinitely.
// 30s accommodates reasoning-model pauses (ChatGPT o-series can pause 20s+ mid-thought).
export const FORCE_EXIT_STABLE_MS = 30_000;


// Provider-specific editor selectors used for health checks (most reliable first).
// Keyed by provider so callers only test selectors relevant to the current session,
// avoiding false positives and unnecessary timeout ticks on unrelated selectors.
export const PROVIDER_EDITOR_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
	  "#prompt-textarea",
	],
  
	perplexity: [
	  '#ask-input[contenteditable="true"]',
	],
  
	gemini: [
	  '[aria-label="Enter a prompt for Gemini"][contenteditable="true"]',
	],
  
	"ai-overview": [
	  'textarea[name="q"]',
	],
  };
  
  
  export const PROVIDER_SUBMIT_BTN_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
	  'button[data-testid="send-button"]',
	],
  
	perplexity: [
	  'button[aria-label="Submit"]',
	],
  
	gemini: [
	  'button[aria-label="Send message"]',
	],
  
	"ai-overview": [
	  'button[aria-label="Search"]',
	],
  };
  
  
  export const PROVIDER_MODEL_RESPONSE_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
	  '[data-message-author-role="assistant"]',
	],
  
	perplexity: [
	  '.prose',
	],
  
	gemini: [
	  'model-response',
	],
  
	"ai-overview": [
	  '[data-container-id="model-response-placeholder"] [data-container-id="main-col"]',
	],
  };
  
  
  export const PROVIDER_RESPONSE_GENERATION_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
	  'button[data-testid="stop-button"]',
	],
  
	perplexity: [
	  'button[aria-label="Stop response (Esc)"]',
	],
  
	gemini: [
	  'button[aria-label="Stop response"]',
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
