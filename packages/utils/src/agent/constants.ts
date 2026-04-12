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

// Array.from(document.querySelectorAll(‘button’))
// .filter(b => b.textContent.toLowerCase().includes(‘sources’))
// .pop()

export const PROVIDER_EDITOR_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
		'#prompt-textarea',
		'div#prompt-textarea[contenteditable="true"][role="textbox"]',
		'div.ProseMirror[contenteditable="true"][role="textbox"]',
		'div[contenteditable="true"][role="textbox"][aria-multiline="true"][aria-label="Chat with ChatGPT"]'
	],
	perplexity: [
		'#ask-input',
		'div#ask-input[contenteditable="true"][role="textbox"]',
		'div[role="textbox"][data-lexical-editor="true"]',
		'div[contenteditable="true"][role="textbox"][data-lexical-editor="true"]'
	],
	gemini: [
		'div[aria-label="Enter a prompt for Gemini"]',
		'rich-textarea [contenteditable="true"][role="textbox"]',
		'div[contenteditable="true"][role="textbox"][aria-multiline="true"]'
	],
	claude: [
		'[data-testid="chat-input"]',
		'div[data-testid="chat-input"][contenteditable="true"][role="textbox"]',
		'[data-testid="chat-input"][aria-multiline="true"]',
	],
	"ai-overview": ['textarea[name="q"][role="combobox"]','textarea[role="combobox"][aria-label="Search"]',],
};

export const PROVIDER_SUBMIT_BTN_SELECTORS: Record<Provider, string[]> = {
	chatgpt: ['button[data-testid="send-button"]'],
	perplexity: ['button[aria-label*="Submit"]'],
	gemini: ['button[aria-label*="Send"]'],
	claude: ['button[aria-label*="Send"]'],
	"ai-overview": [],
};

export const PROVIDER_MODEL_RESPONSE_SELECTORS: Record<Provider, string[]> = {
	chatgpt: [
		'[data-message-author-role="assistant"]',
		'[data-testid^="conversation-turn"][data-turn="assistant"]'
	],
	perplexity: [
		'div[id^="markdown-content-"]',
		'[id^="markdown-content-"] .prose'
	],
	gemini: ['message-content .markdown'],
	claude: [
		'[data-is-streaming="false"] .standard-markdown',
		'.standard-markdown'
	],
	"ai-overview": [
		'[data-container-id="main-col"]'
	],
};

export const PROVIDER_RESPONSE_GENERATION_SELECTORS: Record<
	Provider,
	string[]
> = {
	chatgpt: ['button[data-testid="stop-button"]', 'button[aria-label*="stop" i]'],
	perplexity: ['button[aria-label*="stop" i]'],
	gemini: ['button[aria-label*="stop" i]'],
	claude: ['button[aria-label*="stop" i]'],
	"ai-overview": [],
};

export const RETRYABLE_ERRORS = [
	"ERR_SSL_PROTOCOL_ERROR",
	"ERR_CONNECTION",
	"ERR_TIMED_OUT",
	"ERR_PROXY_CONNECTION_FAILED",
	"Timeout",
];
