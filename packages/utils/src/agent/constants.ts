import type { Provider } from "@oneglanse/types";

// Provider-specific editor selectors used for health checks (most reliable first).
// Keyed by provider so callers only test selectors relevant to the current session,
// avoiding false positives and unnecessary timeout ticks on unrelated selectors.
export const PROVIDER_EDITOR_SELECTORS: Record<Provider, string[]> = {
	openai: [
		"#prompt-textarea",
		'div#prompt-textarea[contenteditable="true"]',
		'[data-testid="composer"] #prompt-textarea',
		'textarea[name="prompt-textarea"]',
	],
	anthropic: [
		'[data-testid="chat-input"][contenteditable="true"]',
		'.ProseMirror[contenteditable="true"]',
		'[data-testid="chat-input-grid-container"] [contenteditable="true"]',
		'textarea[data-testid="chat-input-ssr"]',
	],
	perplexity: [
		'#ask-input[contenteditable="true"]',
		'[data-lexical-editor="true"][contenteditable="true"]',
		'div.relative #ask-input[contenteditable="true"]',
		'div[contenteditable="true"][spellcheck="true"]',
	],
	google: [
		'[contenteditable="true"]',
		'div.ql-editor[contenteditable="true"]',
	],
	"google-ai-overview": [
		'textarea[name="q"]',
		'textarea[name="q"][role="combobox"]',
		'input[name="q"]',
		'textarea[aria-label="Search"]',
		'input[aria-label="Search"]',
	],
};

// Flat list of all editor selectors across providers, used when the provider is
// unknown or when scanning for any available input (e.g. findActiveEditor).
export const EDITOR_SELECTORS = [
	// ======================
	// ChatGPT
	// ======================
	"#prompt-textarea",
	'div#prompt-textarea[contenteditable="true"]',
	'[data-testid="composer"] #prompt-textarea',
	'textarea[name="prompt-textarea"]',

	// ======================
	// Claude
	// ======================
	'[data-testid="chat-input"][contenteditable="true"]',
	'.ProseMirror[contenteditable="true"]',
	'[data-testid="chat-input-grid-container"] [contenteditable="true"]',
	'textarea[data-testid="chat-input-ssr"]',

	// ======================
	// Perplexity
	// ======================
	'#ask-input[contenteditable="true"]',
	'[data-lexical-editor="true"][contenteditable="true"]',
	'div.relative #ask-input[contenteditable="true"]',
	'div[contenteditable="true"][spellcheck="true"]',

	// ======================
	// Gemini
	// ======================
	'div.ql-editor[contenteditable="true"]',

	// ======================
	// Google Search (AI Overview)
	// ======================
	'textarea[name="q"]',
	'input[name="q"]',

	// ======================
	// Cross-platform fallbacks
	// ======================
	'[role="textbox"][contenteditable="true"]',
	'[contenteditable="true"]',

	// ======================
	// Absolute last resort
	// ======================
	"textarea",
	'[role="textbox"]',
	'[data-testid*="editor"]',
	'[aria-label*="message" i]',
	'.text-input-field [contenteditable="true"]',
];

export const SUBMIT_BTN_SELECTORS = [
	// ChatGPT
	'button[data-testid="send-button"]',
	'button[aria-label*="send" i]',
	'button:has(svg[aria-label*="send" i])',

	// Claude
	'button[aria-label="Send message"]',

	// Perplexity
	'button[aria-label*="ask" i]',
	'button[aria-label*="submit" i]',

	// Gemini
	"button.send-button",

	'button[aria-label="Search"]',

	// Fallback
	'button[type="submit"]',
];

export const MODEL_RESPONSE_SELECTORS = [
	// ChatGPT
	'[data-message-author-role="assistant"]',

	// Claude
	'[data-testid="message-content"]',
	".message.assistant",
	".prose",
	// Claude (current UI – authoritative)
	'div[data-is-streaming="false"].group.relative.pb-3',

	// Claude (older / fallback)
	".font-claude-response",
	"message-content",

	// Perplexity
	"article",
	'[data-testid="answer"]',
	".answer",

	// Google/Gemini (for regular Gemini chat responses)
	'[data-message-author-role="model"]',
	".model-response-text",
	"message-content",
	'[role="region"] .markdown-content',
	'[data-container-id="model-response-placeholder"] [data-container-id="main-col"]',

	// Fallback
	"main div:has(p)",
];

export const RESPONSE_GENERATION_SELECTORS = [
	'button[aria-label*="stop" i]',
	'button[aria-label*="cancel" i]',
	'button[aria-label="Stop generating response"]',
	'button[aria-label="Stop response"]',

	// Streaming states (Claude, ChatGPT)
	'[data-streaming="true"]',
	".result-streaming",
	".is-typing",
	'[class*="typing"]',
	'[class*="loading"]',
	'[class*="spinner"]',
	'[class*="streaming"]',

	'[class*="answer"]',
	'[class*="response"]',
	'[class*="result"]',
	'div[role="article"]',
];

export const SOURCES_SELECTORS = [
	// True buttons
	'button:has-text("Sources")',
	'button:has-text("Source")',
	'button:has-text("Citations")',

	// ARIA-driven (ChatGPT, Claude, Perplexity)
	'button[aria-label*="source" i]',
	'button[aria-label*="citation" i]',
	'[role="button"][aria-label*="source" i]',
	'[role="button"][aria-label*="citation" i]',

	// Anchor buttons (rare but exists)
	'a[role="button"]:has-text("Sources")',
	'a:has-text("Sources")',

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
