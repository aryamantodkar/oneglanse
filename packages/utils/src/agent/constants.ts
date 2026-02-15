export const EDITOR_SELECTORS = [
    // ======================
    // ChatGPT
    // ======================
    '#prompt-textarea',
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
    // Cross-platform fallbacks
    // ======================
    '[role="textbox"][contenteditable="true"]',
    '[contenteditable="true"]',
  
    // ======================
    // Absolute last resort
    // ======================
    'textarea',
    '[role="textbox"]',
    '[data-testid*="editor"]',
    '[aria-label*="message" i]',
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
  'button.send-button',

  // Fallback
  'button[type="submit"]',
];

export const MODEL_RESPONSE_SELECTORS = [
  // ChatGPT
  '[data-message-author-role="assistant"]',

  // Claude
  '[data-testid="message-content"]',
  '.message.assistant',
  '.prose',
  // Claude (current UI – authoritative)
  'div[data-is-streaming="false"].group.relative.pb-3',

  // Claude (older / fallback)
  '.font-claude-response',
  'message-content',
  
  // Perplexity
  'article',
  '[data-testid="answer"]',
  '.answer',

  // Fallback
  'main div:has(p)',
];

export const RESPONSE_GENERATION_SELECTORS = [
  'button[aria-label*="stop" i]',
  'button[aria-label*="cancel" i]',
  'button[aria-label="Stop generating response"]',
  'button[aria-label="Stop response"]',

  // Streaming states (Claude, ChatGPT)
  '[data-streaming="true"]',
  '.result-streaming',
  '.is-typing',
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