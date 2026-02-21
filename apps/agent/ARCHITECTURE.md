# Agent Architecture

This document covers the structure of `apps/agent`, the coding conventions used throughout,
and a prioritised list of known improvements for contributors.

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Data Flow](#data-flow)
4. [Module Responsibilities](#module-responsibilities)
5. [Coding Standards](#coding-standards)
6. [Known Improvements](#known-improvements)

---

## Overview

The agent is a Node.js application that uses Playwright to drive real browser sessions against
LLM provider UIs (ChatGPT, Claude, Perplexity, Google Gemini, Google AI Overview). It runs
as two separate processes:

- **API server** (`src/api.ts`, port 3333) — accepts authenticated browser session uploads
- **Worker** (`src/worker.ts`) — pulls jobs from a Redis/BullMQ queue and runs browser automation

Authentication state is persisted on disk per provider in `/storage/<provider>/state.json`.

---

## Directory Structure

```
apps/agent/src/
├── index.ts                    # Process entry point: starts API + worker, handles SIGTERM
├── worker.ts                   # BullMQ worker: processes prompt jobs from Redis queue
├── api.ts                      # HTTP API: session upload + health check endpoints
├── env.ts                      # Loads .env conditionally (dev only)
│
├── auth/                       # CLI-facing authentication helpers
│   ├── auth.ts                 # Entry point for `pnpm auth` CLI command
│   ├── login.ts                # Interactive browser-based login per provider
│   └── upload-session.ts       # Uploads local auth sessions to remote VPS
│
├── agents/                     # Browser automation — provider-specific + orchestration
│   ├── lib/                    # Shared orchestration (provider-agnostic)
│   │   ├── createAgent.ts      # Factory: launches browser + loads session + navigates
│   │   ├── agentHandler.ts     # Retry/proxy rotation strategy (cycles × attempts)
│   │   ├── runAgents.ts        # Top-level: warmup editor → run prompts
│   │   ├── runPrompts.ts       # Prompt execution loop with canary + IP refresh logic
│   │   └── steps/
│   │       ├── askPrompt.ts           # Types prompt, submits via 3-method fallback chain
│   │       ├── fetchPromptResponses.ts # Waits for generation, extracts markdown response
│   │       └── extractSources.ts      # Dispatches to per-provider source extractors
│   │
│   ├── chatgpt/
│   │   ├── auth/validateAuth.ts       # URL + health check for chatgpt.com
│   │   └── lib/extractSources.ts      # Parses OpenAI citations panel
│   ├── claude/
│   │   ├── auth/validateAuth.ts       # URL + health check for claude.ai
│   │   └── lib/extractSources.ts      # Parses anchors from .standard-markdown containers
│   ├── perplexity/
│   │   ├── auth/validateAuth.ts       # URL + DOM profile UI check (3 retry attempts)
│   │   └── lib/extractSources.ts      # Parses fixed-position right sidebar cards
│   └── google/
│       ├── gemini/
│       │   ├── auth/validateAuth.ts   # google.com URL + account button DOM check
│       │   └── lib/extractSources.ts  # Parses References section + decodes redirect URLs
│       └── ai-overview/
│           └── lib/
│               ├── extractSources.ts  # Collects links from the AI Overview container
│               └── extractResponse.ts # Clones + cleans AI Overview HTML for markdown conversion
│
└── lib/                        # Shared utilities (all providers)
    ├── auth/
    │   ├── isAuthenticated.ts          # Dispatcher: routes to per-provider validateAuth
    │   └── waitForAuthentication.ts    # 8-min polling loop for interactive login
    ├── browser/
    │   ├── launchContext.ts            # Playwright context factory with proxy + stealth
    │   ├── navigateWithRetry.ts        # Navigation with retry on transient errors
    │   ├── pageHealthCheck.ts          # Detects bot checks, login walls, rate limits
    │   ├── proxyPool.ts                # Proxy rotation with scoring, cooldowns, exploration
    │   ├── checkPageStability.ts       # (see Known Improvements — inline candidate)
    │   └── setupPage.ts                # (see Known Improvements — remove candidate)
    ├── input/
    │   ├── findActiveEditor.ts         # Finds and focuses the LLM input editor
    │   ├── findEnabledSendButton.ts    # Finds the visible and enabled submit button
    │   ├── getLastAssistantText.ts     # Extracts text from the last assistant message
    │   ├── extractAssistantMarkdown.ts # Converts provider HTML to clean Markdown
    │   ├── waitForAssistantToFinish.ts # Polls until generation indicator disappears
    │   └── warmUpEditor.ts             # Clicks + clears editor before first prompt
    └── utils/
        ├── logger.ts                   # Centralised logging (always use this, never console.*)
        ├── runStep.ts                  # Step wrapper with timing + screenshot on error
        ├── writePromptsToFile.ts       # Persists prompt results to JSON file
        └── dumpHtml.ts                 # (see Known Improvements — dead code)
```

---

## Data Flow

```
Web app (tRPC)
    │
    ▼
BullMQ queue (Redis)
    │
    ▼
worker.ts  ── picks up job ──▶  agentHandler.ts  (retry/proxy loop)
                                      │
                                      ▼
                                createAgent.ts  (launch browser, load session, navigate)
                                      │
                                      ▼
                                runAgents.ts
                                  │       │
                          warmUpEditor   runPrompts.ts  (canary + IP refresh logic)
                                              │
                                    ┌─────────┼──────────┐
                                    ▼         ▼          ▼
                               askPrompt  fetchPromptResponses  extractSources
                                    │         │               │
                                    │         ▼               ▼
                                    │   extractAssistant   per-provider
                                    │     Markdown()       extractor
                                    ▼
                              Result stored in ClickHouse
                              Analysis triggered async
```

### Proxy / retry strategy

`agentHandler.ts` runs an outer **cycle loop** (up to 10 cycles) with an inner **proxy
attempt loop** (up to 10 attempts per cycle). Each cycle rotates to a fresh proxy.
Between cycles the backoff doubles (5 s → 10 s → … capped at 60 s).

`runPrompts.ts` uses a **canary pattern**: the first prompt on a new proxy gets only 1
attempt (fail fast to prove the proxy). Once the first prompt succeeds, subsequent prompts
get full retries. An `IPRefreshNeededError` thrown mid-job triggers a mid-cycle proxy
rotation with accumulated partial results preserved.

---

## Module Responsibilities

### `lib/` — provider-agnostic utilities

Every function in `lib/` must work for any provider. Provider-specific knowledge
(URLs, selectors, DOM structure) belongs in `agents/<provider>/`.

### `agents/lib/` — orchestration layer

Orchestration code that coordinates `lib/` utilities and calls into provider-specific
code. The `steps/` sub-folder contains one file per logical step in the prompt lifecycle.

### `agents/<provider>/` — provider-specific implementations

Each provider owns:
- `auth/validateAuth.ts` — returns `boolean` (is the page authenticated?)
- `lib/extractSources.ts` — returns `Source[]` from the provider's DOM

No provider file should import from another provider's directory.

---

## Coding Standards

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | `camelCase.ts` | `launchContext.ts`, `getLastAssistantText.ts` |
| Class files | `PascalCase.ts` | `AuthError.ts` |
| Functions | `verbNoun` | `findActiveEditor`, `launchContext`, `classifyError` |
| Boolean params/vars | `is` / `has` / `skip` prefix | `isAuthenticated`, `hasProfileUI`, `skipHealthCheck` |
| Module-level constants | `SCREAMING_SNAKE_CASE` | `TIMEOUT_MS`, `MAX_CYCLES`, `PROVIDER_EDITOR_SELECTORS` |
| Types and interfaces | `PascalCase` | `FailureType`, `HealthCheckResult`, `ProviderConfig` |

### Privacy

TypeScript module boundaries are the access modifier. Unexported functions in a file
are private to that file — no `_` prefix convention needed. The rule:

> **If it is not exported, it is private. If it is exported, it is public API.**

Keep public exports minimal — only export what is used by another module.

### Logging

Always use `logger.*` from `lib/utils/logger.ts`. Never use `console.*` directly.

```typescript
// Good
logger.debug("Checking selector:", selector);
logger.warn("Source extraction failed — continuing without sources");
logger.error("Auth check threw:", err);        // pass the full Error object
logger.success("Session detected after 12s");

// Bad
console.log("debug info");
console.error(err.message);  // loses stack trace
```

Log levels:
- `logger.debug` — verbose tracing, suppressed unless `DEBUG_ENABLED=true`
- `logger.log` — normal operational progress
- `logger.warn` — non-fatal issues (retry, fallback used)
- `logger.error` — failures that surface to the caller
- `logger.success` — milestone completions

### Error handling

**Classify before propagating.** Callers must never parse `.message` strings to decide
what to do — use typed errors or a `FailureType` union.

```typescript
// Good — caller can switch on type
throw new AuthError("Session expired");
throw new IPRefreshNeededError("Bot detection on proxy X");

// Good — use classifyError() before logging/scoring
const type = classifyError(err);
await recordProxyResult(proxy, false, type);

// Bad — caller is forced to parse strings
throw new Error("Bot detection OR rate limit OR auth failure");
```

**Silent swallowing** is only acceptable for genuine fire-and-forget side effects.
When you write `.catch(() => {})`, leave a comment explaining why silence is correct:

```typescript
// waitForLoadState can time out on slow pages — we continue regardless
await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
```

### Constants vs magic numbers

Extract any timeout, retry count, or delay that appears more than once to a named constant
in the same file (or a shared config if used across files). Prefer ENV-overridable defaults:

```typescript
// Good
const MAX_RETRIES = parseInt(process.env.MAX_PROMPT_RETRIES ?? "3", 10);
const TIMEOUT_MS = 8 * 60 * 1000;

// Bad
await page.waitForTimeout(2000);   // What is 2000? Why?
for (let i = 0; i < 3; i++) { … } // Magic 3
```

### Selector hygiene

- Import selectors from `@onescope/utils` — never redeclare them locally
- Prefer stable attributes: `aria-label`, `role`, `data-testid`
- Avoid class names; if unavoidable, leave a comment noting fragility:

```typescript
// .standard-markdown is a proprietary class — may break on Claude UI updates
const blocks = await page.locator(".standard-markdown").all();
```

### Module structure

- **One primary export per file** — the filename should reflect the export name
  (`findActiveEditor.ts` exports `findActiveEditor`)
- Private helpers in the same file with no `export` keyword
- No barrel `index.ts` re-exports inside `lib/` sub-folders — keep import paths explicit
  so call sites are easy to trace with grep

---

## Known Improvements

These are grouped by effort, smallest first. Each is self-contained and can be done
independently.

---

### Tier 1 — Dead code removal

These files/exports can be deleted with no logic changes.

| Target | Action | Notes |
|--------|--------|-------|
| `lib/utils/dumpHtml.ts` | Delete | Zero import sites — debug utility never wired up |
| `lib/browser/setupPage.ts` | Delete | Only sets `setDefaultTimeout(0)`; callers can do this directly |
| `lib/browser/checkPageStability.ts` | Inline + delete | 6-line wrapper (`waitForLoadState` + `waitForTimeout`) with one caller — inline into `waitForAuthentication.ts` |
| `lib/browser/proxyPool.ts` → `markProxyBad()` | Remove export | Marked deprecated; superseded by `recordProxyResult()` |

---

### Tier 2 — Duplicate logic extraction

Each item below has the same logic copy-pasted in two or more places. Extract to a
shared helper, update all callers, delete the copies.

#### 2.1 Platform modifier key
**Duplicated in:** `agents/lib/steps/warmUpEditor.ts` and `agents/lib/steps/askPrompt.ts`

```typescript
// New file: lib/utils/platform.ts
export const isMac = process.platform === "darwin";
export const modifierKey = isMac ? "Meta" : "Control";
```

#### 2.2 Error classification
**Duplicated in:** `agents/lib/agentHandler.ts` (`classifyError`) and `agents/lib/runPrompts.ts` (`classifyFailureType`)

The `runPrompts.ts` copy is also missing two cases: `logged_out` and `timeout`.

```typescript
// New file: agents/lib/utils/classifyError.ts
export type FailureType =
  | "connection_error" | "bot_detection" | "logged_out"
  | "rate_limited"    | "no_editor"      | "extraction_failed"
  | "timeout"         | "unknown";

export function classifyError(err: unknown): FailureType { … }
```

Both files import from here and delete their local copies.

#### 2.3 Anthropic block extraction
**Duplicated in:** `lib/input/getLastAssistantText.ts` (lines 35–68) and `lib/input/extractAssistantMarkdown.ts` (lines 243–272) — identical 34-line logic.

```typescript
// New file: lib/input/extractAnthropicBlocks.ts
export async function extractAnthropicBlocks(page: Page): Promise<string[]> { … }
```

#### 2.4 Exponential backoff
**Three independent implementations:**
- `agents/lib/agentHandler.ts` → `getCycleBackoffMs(cycle)`
- `agents/lib/runPrompts.ts` → `getExponentialBackoffDelay(attempt)`
- `agents/lib/steps/fetchPromptResponses.ts` → `getExtractionRetryDelay(attempt)`

```typescript
// New file: agents/lib/utils/backoff.ts
export function exponentialBackoff(attempt: number, baseMs: number, capMs: number): number {
  return Math.min(baseMs * 2 ** attempt, capMs);
}
```

#### 2.5 Editor selectors constant
`lib/browser/pageHealthCheck.ts` redeclares `PROVIDER_EDITOR_SELECTORS` locally.
The source of truth is `@onescope/utils`. Delete the local copy and import from there.

---

### Tier 3 — Module splitting

Files that export multiple unrelated concerns.

#### 3.1 `lib/input/getLastAssistantText.ts`
Currently exports four unrelated functions:

| Function | Should live in |
|----------|---------------|
| `getLastAssistantText()` | `lib/input/getLastAssistantText.ts` (unchanged) |
| `isGenerating()` | `lib/input/isGenerating.ts` (new) |
| `findLastAssistantLocator()` | `lib/input/findAssistantElement.ts` (new) |
| `findLastAssistantBox()` | `lib/input/findAssistantElement.ts` (new) |

Update all import sites after the split.

#### 3.2 `lib/input/extractAssistantMarkdown.ts`
200+ lines of Turndown custom rules are inline. Extract the configured `TurndownService`
instance to `lib/input/markdownConverter.ts` and import it in `extractAssistantMarkdown.ts`.

---

### Tier 4 — `console.log` → `logger`

`agents/google/ai-overview/lib/extractSources.ts` (lines 53, 57, 60, 141, 147, 150)
uses `console.log()`. Replace with `logger.debug()`.

---

### Tier 5 — Provider registry (largest change)

Adding a provider today requires modifying 4+ files. The fix is a central registry:

```typescript
// New file: agents/lib/providerRegistry.ts
export interface ProviderConfig {
  entryUrl: string;
  preNavigationHook?: (page: Page) => Promise<void>;
  extractSources: (page: Page) => Promise<Source[]>;
}

export const AGENT_PROVIDER_CONFIG: Record<Provider, ProviderConfig> = {
  openai:               { entryUrl: "https://chatgpt.com",       extractSources: extractChatGPTSources },
  anthropic:            { entryUrl: "https://claude.ai",         extractSources: extractClaudeSources },
  perplexity:           { entryUrl: "https://www.perplexity.ai", extractSources: extractPerplexitySources },
  google:               { entryUrl: "https://gemini.google.com", extractSources: extractGoogleSources },
  "google-ai-overview": { entryUrl: "https://www.google.com",   extractSources: extractAIOverviewSources },
};
```

`createAgent.ts` reads `AGENT_PROVIDER_CONFIG[provider].entryUrl` instead of a hardcoded
map. `extractSources.ts` calls `AGENT_PROVIDER_CONFIG[provider].extractSources(page)`
instead of an if/else chain. Adding a new provider = one entry in the registry.

---

---

## Target `lib/` Structure

The current `lib/` has several files that do too much. Below is the proposed target layout
after all Tier 1–4 improvements are applied. Each file exports one primary function.

### Current → Target

#### `lib/input/` (current — 7 files, some doing multiple jobs)

```
lib/input/
├── extractAssistantMarkdown.ts   # 287 lines — Turndown config + extraction logic mixed
├── findActiveEditor.ts           # exports findActiveEditor() + waitForEditorReady()
├── findEnabledSendButton.ts      # focused — keep as-is
├── getLastAssistantText.ts       # exports 4 unrelated functions
├── waitForAssistantToFinish.ts   # focused — keep as-is
└── warmUpEditor.ts               # focused — keep as-is
```

#### `lib/input/` (target — 10 files, one job each)

```
lib/input/
├── markdownConverter.ts          # NEW — pre-configured TurndownService instance + all rules
├── extractAssistantMarkdown.ts   # slimmed — calls markdownConverter, handles provider routing
├── extractAnthropicBlocks.ts     # NEW — shared Anthropic .standard-markdown extraction
├── findActiveEditor.ts           # findActiveEditor() (private) + waitForEditorReady() (public)
├── findEnabledSendButton.ts      # findEnabledSendButton() — unchanged
├── getLastAssistantText.ts       # getLastAssistantText() only
├── isGenerating.ts               # NEW — isGenerating() extracted from getLastAssistantText.ts
├── findAssistantElement.ts       # NEW — findLastAssistantLocator() + findLastAssistantBox()
├── waitForAssistantToFinish.ts   # unchanged
└── warmUpEditor.ts               # unchanged
```

---

#### `lib/browser/` (current — 6 files, 2 are candidates for removal)

```
lib/browser/
├── checkPageStability.ts    # 6-line wrapper — inline into its one caller, delete
├── launchContext.ts         # focused — keep as-is
├── navigateWithRetry.ts     # focused — keep as-is
├── pageHealthCheck.ts       # focused but redeclares selectors — import instead
├── proxyPool.ts             # focused — remove deprecated markProxyBad() export
└── setupPage.ts             # single line, mostly commented — delete
```

#### `lib/browser/` (target — 4 files)

```
lib/browser/
├── launchContext.ts         # unchanged
├── navigateWithRetry.ts     # unchanged
├── pageHealthCheck.ts       # imports PROVIDER_EDITOR_SELECTORS from @onescope/utils
└── proxyPool.ts             # markProxyBad() removed
```

---

#### `lib/utils/` (current — 4 files, 1 unused)

```
lib/utils/
├── dumpHtml.ts              # 0 callers — delete
├── logger.ts                # focused — keep as-is
├── runStep.ts               # focused — keep as-is
└── writePromptsToFile.ts    # focused — keep as-is
```

#### `lib/utils/` (target — 4 files)

```
lib/utils/
├── logger.ts                # unchanged
├── platform.ts              # NEW — isMac + modifierKey (extracted from 2 step files)
├── runStep.ts               # unchanged
└── writePromptsToFile.ts    # unchanged
```

---

#### `agents/lib/` (current — no utils sub-folder)

```
agents/lib/
├── createAgent.ts
├── agentHandler.ts          # contains classifyError() + getCycleBackoffMs() inline
├── runAgents.ts
├── runPrompts.ts            # contains classifyFailureType() + getExponentialBackoffDelay() inline
└── steps/
    ├── askPrompt.ts         # contains getExponentialBackoffDelay() inline
    ├── extractSources.ts
    └── fetchPromptResponses.ts
```

#### `agents/lib/` (target — utilities extracted)

```
agents/lib/
├── createAgent.ts
├── agentHandler.ts          # imports from utils/
├── runAgents.ts
├── runPrompts.ts            # imports from utils/
├── steps/
│   ├── askPrompt.ts
│   ├── extractSources.ts
│   └── fetchPromptResponses.ts
└── utils/
    ├── backoff.ts           # NEW — exponentialBackoff() used by agentHandler + runPrompts + fetchPromptResponses
    └── classifyError.ts     # NEW — FailureType + classifyError() used by agentHandler + runPrompts
```

---

### Rule of thumb for `lib/` files

A file in `lib/` is too big or doing too much if any of these are true:

- It exports more than one **conceptually distinct** function
- It has more than ~100 lines after private helpers are subtracted
- A new contributor would not immediately know which function to look at from the filename alone

When in doubt: **one file, one exported function, one clear name.**

---

## Contributing

1. Run `pnpm --filter @onescope/agent typecheck` after every change — zero errors required
2. Keep each PR scoped to one tier from the Known Improvements list above
3. Follow the naming and logging conventions in the [Coding Standards](#coding-standards) section
4. Do not introduce new `console.*` calls — use `logger.*`
5. Do not redeclare selectors locally — import from `@onescope/utils`
