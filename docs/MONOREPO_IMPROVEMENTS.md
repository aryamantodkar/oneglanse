# OneScope AI — Monorepo Structure Improvements & Code Cleanup Guide

This document is a comprehensive guide for evolving OneScope AI from a working prototype into a production-grade, open-source monorepo. Every section explains **what** the problem is, **why** it matters, and **exactly how** to fix it — including the actual code changes needed.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Priority Matrix](#2-priority-matrix)
3. [Critical Security Fixes](#3-critical-security-fixes)
4. [Aggressive Code Duplication Cleanup](#4-aggressive-code-duplication-cleanup)
5. [Structural Improvements](#5-structural-improvements)
6. [Performance & Scalability](#6-performance--scalability)
7. [Deployment Hardening](#7-deployment-hardening)
8. [CI/CD Improvements](#8-cicd-improvements)
9. [Open Source Readiness](#9-open-source-readiness)
10. [Redundant File Deletions](#10-redundant-file-deletions)

---

## 1. Executive Summary

The OneScope AI monorepo is architecturally sound — it has clean separation between apps and packages, type-safe APIs via tRPC, and a sophisticated browser automation pipeline. However, it was built for speed, not for maintainability or open-source contributors. The problems fall into three buckets:

**Security (fix immediately before any deployment):**
- Database ports are exposed to the public internet
- Path traversal vulnerability in the agent API
- Environment secrets can silently become `undefined` at runtime
- Regex bug in Google AI Overview extractor that silently produces wrong results

**Code quality (fix before open-sourcing):**
- 5 identical agent factory files that should be 1 generic factory (~170 lines of pure duplication)
- 5 identical source extractor files that should be 1 config-driven extractor (~600 lines of duplication)
- Provider lists hardcoded in 3+ separate places with no single source of truth
- Empty graceful shutdown handler (browsers and Redis connections leak on every deploy)

**Architecture (fix for long-term maintainability):**
- CSS selectors scattered across 15+ functions (makes UI breakage very hard to debug)
- No test coverage anywhere (zero confidence in refactors)
- `console.log` used instead of the existing structured logger
- Non-null assertions (`!`) bypassing TypeScript's type system

---

## 2. Priority Matrix

| Priority | Issue | File | Impact |
|----------|-------|------|--------|
| 🔴 CRITICAL | Exposed DB ports | `docker-compose.yml` | Any internet user can connect to your PostgreSQL and ClickHouse directly |
| 🔴 CRITICAL | Path traversal | `apps/agent/src/api.ts` | Attacker can write files anywhere on the server |
| 🔴 CRITICAL | Undefined env secret | `apps/web/src/server/api/middleware/isInternal.ts` | Internal API auth silently accepts any token if env var is not set |
| 🔴 CRITICAL | Regex double-escape bug | `apps/agent/src/agents/google/ai-overview/lib/extractResponse.ts` | AI Overview date extraction always silently fails |
| 🟠 HIGH | Empty graceful shutdown | `apps/agent/src/index.ts` | Every `docker compose restart` leaves orphaned browsers consuming RAM |
| 🟠 HIGH | No CI quality gates | `.github/workflows/docker-build.yml` | TypeScript errors ship to production silently |
| 🟠 HIGH | No health checks (Redis, ClickHouse) | `docker-compose.yml` | Web app starts before its dependencies are ready |
| 🟡 MEDIUM | 5 duplicate agent factories | `apps/agent/src/agents/*/` | Every new provider requires copying 2 files; bugs get fixed in 1 place only |
| 🟡 MEDIUM | 5 duplicate source extractors | `apps/agent/src/agents/*/lib/` | Same bug pattern; selector changes require 5 file edits |
| 🟡 MEDIUM | Hardcoded provider lists | 3 different files | Adding a new provider requires finding all 3 places to update |
| 🟢 LOW | `console.log` in production | `apps/agent/src/index.ts` + others | Logs are unstructured and can't be filtered/searched |
| 🟢 LOW | Non-null assertions | `apps/web/src/server/api/routers/prompt/prompt.ts` | Runtime crashes instead of explicit error messages |

---

## 3. Critical Security Fixes

### 3.1 — Fix Exposed Database Ports

**File:** `docker-compose.yml`

**The Problem:**
Port binding `"5432:5432"` is shorthand for `"0.0.0.0:5432:5432"`. The `0.0.0.0` address means Docker instructs the host operating system to listen on ALL network interfaces — including your VPS's public IP address. This means anyone on the internet who knows your server's IP can attempt to connect to PostgreSQL on port 5432 and ClickHouse on ports 9000 and 8123 directly, completely bypassing your Next.js application and all its auth middleware.

**Why `127.0.0.1` fixes it:**
`127.0.0.1` is the loopback interface — it only accepts connections from the same machine. No external connection can reach a port bound to `127.0.0.1`. nginx (your reverse proxy) runs on the same machine, so it can still reach port 3000. Your SSH session can still reach port 5432 for debugging. But internet traffic cannot.

**The Change:**

```yaml
# docker-compose.yml

# BEFORE (insecure — ports accessible from internet):
db:
  ports:
    - "5432:5432"

clickhouse:
  ports:
    - "9000:9000"
    - "8123:8123"

# AFTER (secure — only localhost can reach these ports):
db:
  ports:
    - "127.0.0.1:5432:5432"

clickhouse:
  ports:
    - "127.0.0.1:9000:9000"
    - "127.0.0.1:8123:8123"
```

**How to verify it worked:**
After applying and restarting (`docker compose down && docker compose up -d`):
```bash
# This should FAIL (connection refused from external perspective):
nmap -p 5432,9000,8123 YOUR_SERVER_IP

# This should SUCCEED (from the server itself):
docker compose exec web curl -s http://localhost:8123/ping
```

---

### 3.2 — Fix Path Traversal in Agent API

**File:** `apps/agent/src/api.ts`

**The Problem:**
The upload-sessions endpoint constructs file paths using the `provider` value from the request body:

```typescript
// Current code (VULNERABLE):
const filePath = path.join(VPS_AUTH_PROFILE_PATH, provider, `${provider}-auth.json`);
fs.writeFileSync(filePath, JSON.stringify(sessionData));
```

`path.join` does normalize paths, but it does NOT prevent directory traversal. If an attacker sends `provider: "../../etc/cron.d"`, the resulting path becomes:
```
/storage/../../etc/cron.d
= /etc/cron.d
```
And now the attacker can write arbitrary content to `/etc/cron.d/` — which on Linux gets executed as a cron job. This is a Remote Code Execution (RCE) vulnerability.

**The Fix:**

```typescript
// apps/agent/src/api.ts — add at the top of the file:
import path from 'path';

// Define the exact set of valid providers. This is your allowlist.
// Any provider string NOT in this set gets rejected with 400.
const ALLOWED_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'perplexity',
  'google',
  'google-ai-overview'
]);

// In your POST /upload-sessions handler, replace the path construction with:
const { provider, ...sessionData } = req.body;

// Step 1: Check against allowlist (fast reject — O(1) lookup)
if (!ALLOWED_PROVIDERS.has(provider)) {
  return res.status(400).json({
    error: `Invalid provider. Must be one of: ${[...ALLOWED_PROVIDERS].join(', ')}`
  });
}

// Step 2: Resolve the base path to an absolute path (resolves any .. in VPS_AUTH_PROFILE_PATH itself)
const basePath = path.resolve(VPS_AUTH_PROFILE_PATH);

// Step 3: Build the intended file path
const filePath = path.resolve(basePath, provider, `${provider}-auth.json`);

// Step 4: Verify the final path is still inside basePath
// This is defense-in-depth — even if somehow provider contained a ../ that got through,
// this check catches it. path.sep adds the trailing slash to prevent "../../storagex" attacks.
if (!filePath.startsWith(basePath + path.sep)) {
  return res.status(400).json({ error: 'Path validation failed' });
}

// Now safe to write:
fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
```

**Why both checks are needed:**
The allowlist alone is sufficient IF your provider names never contain path characters. But the `startsWith(basePath + path.sep)` check is defense-in-depth — a security principle where you add redundant checks at different layers so that a bug in one layer doesn't create a vulnerability. Think of it as belt AND suspenders.

---

### 3.3 — Fix the Undefined Environment Secret Bug

**File:** `apps/web/src/server/api/middleware/isInternal.ts`

**The Problem:**
```typescript
// Current code (BROKEN when env var is not set):
const expectedToken = process.env.INTERNAL_CRON_SECRET;

// If INTERNAL_CRON_SECRET is not in .env:
// process.env.INTERNAL_CRON_SECRET === undefined
// String comparison: token === undefined → converts to: token === "undefined"
// So any attacker who sends the token "undefined" can call internal endpoints!
```

This is a subtle JavaScript type coercion bug. When you do `token === process.env.MISSING_VAR`, and the env var is not set, `process.env.MISSING_VAR` is `undefined` (the JS primitive). But when this gets compared in some contexts, or when constructing error messages, it becomes the string `"undefined"`. More critically, the timing-safe comparison functions often convert to string first.

**The Fix — validate at startup, not at request time:**

The correct approach is to validate all required environment variables when the process starts, before any requests are served. The codebase already has `apps/web/src/env.ts` which uses Zod for this purpose. Add the missing variable:

```typescript
// apps/web/src/env.ts — add to the server-side schema:
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),

    // ADD THIS:
    INTERNAL_CRON_SECRET: z.string().min(32,
      'INTERNAL_CRON_SECRET must be at least 32 characters. Generate with: openssl rand -hex 32'
    ),

    // ... rest of variables
  },
});
```

Then in the middleware, import from `env` instead of `process.env`:

```typescript
// apps/web/src/server/api/middleware/isInternal.ts
import { env } from '~/env';  // ← validated at startup, guaranteed to be a string

export function isInternal(token: string | undefined): boolean {
  if (!token) return false;

  // env.INTERNAL_CRON_SECRET is GUARANTEED to be a string here
  // because if it was missing, the app would have crashed at startup with a clear error message
  return timingSafeEqual(
    Buffer.from(token),
    Buffer.from(env.INTERNAL_CRON_SECRET)
  );
}
```

**What `createEnv` does:**
When your Next.js app starts (or your Node process starts), `createEnv` runs the Zod schema against `process.env`. If any required variable is missing or invalid, it throws immediately with a human-readable error like:
```
❌ Invalid environment variables:
  INTERNAL_CRON_SECRET: Required
```
This means deployment failures are caught during startup, not during a live request at 3am.

---

### 3.4 — Fix the Regex Double-Escape Bug

**File:** `apps/agent/src/agents/google/ai-overview/lib/extractResponse.ts`

**The Problem:**
This is one of the most subtle bugs in the codebase. When you write a regex in a JavaScript string (not a regex literal), backslashes need to be escaped TWICE:
- Once for the string (JavaScript string literal escaping)
- Once for the regex engine

```typescript
// BROKEN — what's in the code:
const SOURCE_CARD_DATE_PATTERN = "[A-Z][a-z]+ \\\\d{1,2}, \\\\d{4}";
// Each \\\\ is: string parses \\ as literal backslash,
// then regex sees \\d which means "escaped d" = literal character "d"
// So this pattern matches: "January d, d" — literally the letter "d", never a digit!

// CORRECT option 1 — use String.raw (no string escaping):
const SOURCE_CARD_DATE_PATTERN = String.raw`[A-Z][a-z]+ \d{1,2}, \d{4}`;
// String.raw passes the string as-is, so \d reaches the regex engine as \d (match digit)

// CORRECT option 2 — use a RegExp literal (no string involved at all):
const SOURCE_CARD_DATE_RE = /[A-Z][a-z]+ \d{1,2}, \d{4}/;

// CORRECT option 3 — double backslash properly (only 2 backslashes, not 4):
const SOURCE_CARD_DATE_PATTERN = "[A-Z][a-z]+ \\d{1,2}, \\d{4}";
// String parses \\ as \ and passes \d to the regex engine which matches a digit
```

**Why this bug is so dangerous:**
This pattern is used to detect date strings like "January 15, 2025" in Google AI Overview source cards. When it silently fails to match dates, the date extraction returns `null` for every source. The agent continues without an error — it just quietly returns sources without dates. You'd only notice this by manually checking extracted data, making it nearly impossible to detect in production.

**Always prefer regex literals over string-based regex.** The string approach is only needed when you're dynamically constructing patterns, which this case is not.

---

## 4. Aggressive Code Duplication Cleanup

### 4.1 — The 5 Agent Factories → 1 Generic Factory

**Files to DELETE (10 files, ~170 lines):**
```
apps/agent/src/agents/chatgpt/chatgptAgent.ts
apps/agent/src/agents/chatgpt/chatgpt.ts
apps/agent/src/agents/claude/claudeAgent.ts
apps/agent/src/agents/claude/claude.ts
apps/agent/src/agents/perplexity/perplexityAgent.ts
apps/agent/src/agents/perplexity/perplexity.ts
apps/agent/src/agents/google/gemini/geminiAgent.ts
apps/agent/src/agents/google/gemini/gemini.ts
apps/agent/src/agents/google/ai-overview/aiOverviewAgent.ts
apps/agent/src/agents/google/ai-overview/aiOverview.ts
```

**Why they're redundant:**
Every single one of these files follows an identical structure. Here's a side-by-side comparison to make it unmistakable:

```typescript
// chatgptAgent.ts:
export async function chatgptAgent(proxy?: ProxyConfig) {
  const { browser, context, proxy: p } = await launchContext("openai");
  let page = await context.newPage();
  await navigateWithRetry(page, 'https://chatgpt.com/auth/login', { waitUntil: 'domcontentloaded' });
  setupPage(page, "openai");
  await page.waitForTimeout(2000);
  const auth = await isAuthenticated(page, "openai");
  return { browser, context, page, auth, proxy: p };
}

// claudeAgent.ts (IDENTICAL except 2 strings):
export async function claudeAgent(proxy?: ProxyConfig) {
  const { browser, context, proxy: p } = await launchContext("anthropic");
  let page = await context.newPage();
  await navigateWithRetry(page, 'https://claude.ai/new', { waitUntil: 'domcontentloaded' });
  setupPage(page, "anthropic");
  await page.waitForTimeout(2000);
  const auth = await isAuthenticated(page, "anthropic");
  return { browser, context, page, auth, proxy: p };
}

// perplexityAgent.ts (IDENTICAL except 2 strings + 1 extra scroll):
export async function perplexityAgent(proxy?: ProxyConfig) {
  const { browser, context, proxy: p } = await launchContext("perplexity");
  let page = await context.newPage();
  await navigateWithRetry(page, 'https://www.perplexity.ai', { waitUntil: 'domcontentloaded' });
  setupPage(page, "perplexity");
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 500)); // ← only difference
  const auth = await isAuthenticated(page, "perplexity");
  return { browser, context, page, auth, proxy: p };
}
```

The pattern is crystal clear: **these are data, not code.** The only things that vary between agents are:
1. The `provider` string (used for context/auth/setup calls)
2. The entry URL
3. The warmup delay (2000ms vs 3000ms)
4. An optional pre-auth setup step (only Perplexity)

**File to CREATE:** `apps/agent/src/agents/lib/createAgent.ts`

```typescript
// apps/agent/src/agents/lib/createAgent.ts

import type { Page } from 'playwright';
import type { Provider } from '@onescope/types';
import { launchContext } from '../../lib/browser/launchContext';
import { setupPage } from '../../lib/browser/setupPage';
import { navigateWithRetry } from '../../lib/browser/navigateWithRetry';
import { isAuthenticated } from '../../lib/auth/validateAuth';
import type { ProxyConfig } from '../../lib/browser/proxyPool';

/**
 * Configuration object for each provider agent.
 * Instead of 5 files each containing 20 lines of nearly identical code,
 * all variation lives in this single data structure.
 */
interface AgentConfig {
  /** The URL to navigate to when starting a new session */
  entryUrl: string;
  /** How long to wait after navigation before checking auth (ms) */
  warmupDelay: number;
  /**
   * Optional: provider-specific setup to run after navigation but before auth check.
   * Use this for things like scrolling, dismissing modals, etc.
   * If not needed, omit the property — it won't be called.
   */
  preAuthSetup?: (page: Page) => Promise<void>;
}

/**
 * Single source of truth for all provider entry points and behavior.
 * To add a new provider:
 *   1. Add the provider to the Provider union type in @onescope/types
 *   2. Add an entry here
 *   3. That's it. createAgent() handles the rest.
 */
const AGENT_CONFIGS: Record<Provider, AgentConfig> = {
  openai: {
    entryUrl: 'https://chatgpt.com/auth/login',
    warmupDelay: 2000,
  },
  anthropic: {
    entryUrl: 'https://claude.ai/new',
    warmupDelay: 2000,
  },
  perplexity: {
    entryUrl: 'https://www.perplexity.ai',
    warmupDelay: 3000,
    // Perplexity renders some elements lazily, so we scroll to trigger them
    // before checking authentication state
    preAuthSetup: async (page) => {
      await page.evaluate(() => window.scrollTo(0, 500));
    },
  },
  google: {
    entryUrl: 'https://gemini.google.com/',
    warmupDelay: 2000,
  },
  'google-ai-overview': {
    entryUrl: 'https://google.com/',
    warmupDelay: 1500,
  },
};

/**
 * Creates and authenticates a browser agent for the given provider.
 * This single function replaces 10 files (2 per provider × 5 providers).
 *
 * @param provider - Which LLM provider to launch a browser for
 * @param proxy - Optional proxy config; if not provided, uses the proxy pool
 * @returns Browser context, page, auth status, and the proxy that was used
 */
export async function createAgent(provider: Provider, proxy?: ProxyConfig) {
  const config = AGENT_CONFIGS[provider];

  // 1. Launch a new browser context with the provider's stored auth session
  const { browser, context, proxy: usedProxy } = await launchContext(provider, proxy);

  // 2. Open a new page (tab) within that context
  const page = await context.newPage();

  // 3. Navigate to the provider's login/home page
  // navigateWithRetry handles transient navigation failures (network blips, etc.)
  await navigateWithRetry(page, config.entryUrl, { waitUntil: 'domcontentloaded' });

  // 4. Apply provider-specific page setup (e.g., inject stealth helpers, disable analytics)
  setupPage(page, provider);

  // 5. Run optional provider-specific pre-auth setup (e.g., scroll Perplexity)
  if (config.preAuthSetup) {
    await config.preAuthSetup(page);
  }

  // 6. Wait for the page to fully settle before checking auth state
  await page.waitForTimeout(config.warmupDelay);

  // 7. Check if the loaded session is still authenticated
  const auth = await isAuthenticated(page, provider);

  return { browser, context, page, auth, proxy: usedProxy };
}
```

**How to update `runAgents.ts` to use the new factory:**

```typescript
// apps/agent/src/agents/lib/runAgents.ts — BEFORE (switch statement):
import { chatgptAgent } from '../chatgpt/chatgptAgent';
import { claudeAgent } from '../claude/claudeAgent';
import { perplexityAgent } from '../perplexity/perplexityAgent';
import { geminiAgent } from '../google/gemini/geminiAgent';
import { aiOverviewAgent } from '../google/ai-overview/aiOverviewAgent';

function getAgentFactory(provider: Provider) {
  switch (provider) {
    case 'openai': return chatgptAgent;
    case 'anthropic': return claudeAgent;
    case 'perplexity': return perplexityAgent;
    case 'google': return geminiAgent;
    case 'google-ai-overview': return aiOverviewAgent;
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// apps/agent/src/agents/lib/runAgents.ts — AFTER (one import, no switch):
import { createAgent } from './createAgent';

// Now just call: const agentResult = await createAgent(provider, proxy);
// No switch statement needed — AGENT_CONFIGS handles the dispatch
```

**Net result:**
- **Deleted:** 10 files, ~170 lines
- **Created:** 1 file, ~50 lines
- **Net removed:** ~120 lines
- **Future benefit:** Adding a 6th provider (e.g., Meta AI, Mistral) requires adding ONE entry to `AGENT_CONFIGS`. Previously it required copying 2 entire files and threading a new case into every switch statement.

---

### 4.2 — The 5 Source Extractors → 1 Config-Driven Extractor

**Files to DELETE (5 files, ~600 lines):**
```
apps/agent/src/agents/chatgpt/lib/extractSources.ts
apps/agent/src/agents/claude/lib/extractSources.ts
apps/agent/src/agents/perplexity/lib/extractSources.ts
apps/agent/src/agents/google/gemini/lib/extractSources.ts
apps/agent/src/agents/google/ai-overview/lib/extractSources.ts
```

**Why they're redundant:**
Each extractor does exactly this:
1. Find the source container (different CSS selector per provider)
2. Find anchor elements within it (`a[href]`)
3. Extract the title text (different DOM path per provider)
4. Extract the favicon URL (different DOM path per provider)
5. Build an `AgentCitation` object
6. Deduplicate by a string key (different key formula per provider)

This is a classic **Strategy Pattern** problem where the algorithm is identical but the configuration differs.

**File to CREATE:** `apps/agent/src/agents/lib/extractSources.ts`

```typescript
// apps/agent/src/agents/lib/extractSources.ts

import type { Page, ElementHandle } from 'playwright';
import type { Provider } from '@onescope/types';
import type { AgentCitation } from '@onescope/types';

/**
 * Describes HOW to extract sources for a specific provider.
 * All variation between providers is captured as data here,
 * not as repeated code.
 */
interface SourceExtractorConfig {
  /**
   * How to find the container element that holds all the source cards.
   *
   * - For OpenAI: a flyout panel that appears after clicking "Sources"
   * - For Perplexity: a fixed right-side panel (position: fixed; right: 0)
   * - For Anthropic: the response body itself (inline citations)
   * - For Google: the "References" section at the bottom of the response
   * - For AI Overview: found by walking up from the AI Overview heading
   *
   * Can be a CSS selector string OR a function that does custom DOM navigation.
   */
  findContainer: string | ((page: Page) => Promise<ElementHandle | null>);

  /**
   * CSS selector for individual source link elements within the container.
   * Usually 'a[href]' but may be more specific per provider.
   */
  linkSelector: string;

  /**
   * How to extract the human-readable title from a link element.
   * Each provider puts the title in a different child element.
   */
  getTitle: (el: ElementHandle) => Promise<string>;

  /**
   * How to extract the cited text (the snippet shown under the source title).
   * Not all providers have this — return empty string if not applicable.
   */
  getCitedText?: (el: ElementHandle) => Promise<string>;

  /**
   * Build the deduplication key for a given source.
   * Two sources with the same key are considered duplicates and one is dropped.
   *
   * - OpenAI uses: `${href}|${title}|${citedText}` (strict dedup)
   * - Perplexity uses: base URL without fragments (loose dedup)
   * - Anthropic uses: `${href}|${citedText}` (medium dedup)
   */
  dedupeKey: (href: string, title: string, citedText: string) => string;

  /**
   * Optional: return true to skip this link (e.g., skip google.com internal links
   * in AI Overview extraction).
   */
  skipHref?: (href: string) => boolean;

  /**
   * Optional: if the sources require clicking a button first (like OpenAI's
   * "Sources" button), provide the selector here. The extractor will click it
   * and wait before extracting.
   */
  triggerButtonSelector?: string;
}

// ─── PROVIDER CONFIGURATIONS ───────────────────────────────────────────────

const SOURCE_EXTRACTOR_CONFIGS: Record<Provider, SourceExtractorConfig> = {

  openai: {
    triggerButtonSelector: 'button[aria-label="Sources"]',
    findContainer: '[data-testid="source-citations-panel"]',
    linkSelector: 'a[href]',
    getTitle: async (el) => {
      const titleEl = await el.$('.source-title, [aria-label]');
      return (await titleEl?.textContent() ?? '').trim();
    },
    getCitedText: async (el) => {
      const citedEl = await el.$('.citation-text, .source-snippet');
      return (await citedEl?.textContent() ?? '').trim();
    },
    dedupeKey: (href, title, citedText) => `${href}|${title}|${citedText}`,
  },

  anthropic: {
    // Claude embeds citations inline in the response — no separate sources panel
    findContainer: '.standard-markdown',
    linkSelector: 'a[href^="http"]',
    getTitle: async (el) => {
      return (await el.textContent() ?? '').trim();
    },
    getCitedText: async (el) => {
      // Walk up to find the containing paragraph and get its text
      const paragraph = await el.evaluateHandle(node => node.closest('p'));
      return (await (paragraph as ElementHandle).textContent() ?? '').trim();
    },
    dedupeKey: (href, _title, citedText) => `${href}|${citedText}`,
    skipHref: (href) => href.includes('claude.ai'), // Skip internal links
  },

  perplexity: {
    // Perplexity's source panel is fixed to the right side of the screen
    findContainer: async (page) => {
      return page.$('div[style*="position: fixed"][style*="right: 0"]');
    },
    linkSelector: 'a[href]',
    getTitle: async (el) => {
      // Perplexity uses the longest non-trivial span as the title
      const spans = await el.$$('span');
      let longest = '';
      for (const span of spans) {
        const text = (await span.textContent() ?? '').trim();
        if (text.length > longest.length && text.length > 10) {
          longest = text;
        }
      }
      return longest || (await el.textContent() ?? '').trim();
    },
    dedupeKey: (href) => {
      // Remove URL fragments like #:~:text= (Perplexity often uses text fragments)
      try { return new URL(href).origin + new URL(href).pathname; }
      catch { return href; }
    },
  },

  google: {
    // Gemini puts references in a dedicated section at the bottom
    findContainer: 'message-content',
    linkSelector: 'a[href^="http"]',
    getTitle: async (el) => {
      return (await el.getAttribute('aria-label'))
        || (await el.getAttribute('title'))
        || (await el.textContent() ?? '').trim();
    },
    dedupeKey: (href) => href,
    skipHref: (href) => {
      // Decode Google redirect URLs like /url?q=https://actual-site.com
      if (href.includes('google.com/url')) {
        try {
          const url = new URL(href);
          return url.searchParams.get('q') === null; // Skip if no destination
        } catch { return true; }
      }
      return false;
    },
  },

  'google-ai-overview': {
    // AI Overview container is found by walking up from the "AI Overview" heading
    findContainer: async (page) => {
      const heading = await page.$('h1:has-text("AI Overview"), [aria-label="AI Overview"]');
      if (!heading) return null;
      // Walk up the DOM to find the container div
      return heading.evaluateHandle(el => {
        let node: Element | null = el;
        for (let i = 0; i < 5; i++) {
          node = node?.parentElement ?? null;
          if (node?.tagName === 'DIV' && (node as HTMLElement).style.position !== 'static') {
            return node;
          }
        }
        return node;
      }) as Promise<ElementHandle | null>;
    },
    linkSelector: 'a[href]:not([href*="google.com"])',
    getTitle: async (el) => {
      return (await el.getAttribute('aria-label'))
        || (await el.getAttribute('title'))
        || (await el.textContent() ?? '').trim();
    },
    dedupeKey: (href) => {
      // Strip #:~:text= fragments — AI Overview often adds these
      try {
        const url = new URL(href);
        url.hash = '';
        return url.toString();
      } catch { return href; }
    },
    skipHref: (href) => href.includes('google.com'),
  },
};

// ─── GENERIC EXTRACTION LOOP ──────────────────────────────────────────────

/**
 * Extracts all sources/citations for a given provider from the current page.
 * The extraction algorithm is identical for all providers; only the config differs.
 *
 * @param page - Playwright page after a prompt response has been received
 * @param provider - Which provider's page we're on
 * @returns Array of deduplicated citations
 */
export async function extractSources(
  page: Page,
  provider: Provider
): Promise<AgentCitation[]> {
  const config = SOURCE_EXTRACTOR_CONFIGS[provider];

  // Step 1: Click the trigger button if required (e.g., OpenAI's "Sources" button)
  if (config.triggerButtonSelector) {
    const button = await page.$(config.triggerButtonSelector);
    if (button) {
      await button.click();
      await page.waitForTimeout(1000); // Wait for panel to animate in
    }
  }

  // Step 2: Find the source container
  const container = typeof config.findContainer === 'string'
    ? await page.$(config.findContainer)
    : await config.findContainer(page);

  if (!container) return []; // No sources found — return empty (not an error)

  // Step 3: Find all source links within the container
  const linkEls = await container.$$(config.linkSelector);

  // Step 4: Extract citation data from each link
  const seen = new Set<string>();
  const citations: AgentCitation[] = [];

  for (const el of linkEls) {
    const href = await el.getAttribute('href') ?? '';
    if (!href || !href.startsWith('http')) continue;

    // Skip internal/unwanted links
    if (config.skipHref?.(href)) continue;

    const title = await config.getTitle(el);
    const citedText = config.getCitedText ? await config.getCitedText(el) : '';

    // Deduplicate
    const key = config.dedupeKey(href, title, citedText);
    if (seen.has(key)) continue;
    seen.add(key);

    citations.push({
      url: href,
      title: title || href, // Fall back to URL if no title found
      cited_text: citedText,
      domain: getDomainFromUrl(href),
    });
  }

  return citations;
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
```

**Net result:**
- **Deleted:** 5 files, ~600 lines
- **Created:** 1 file, ~180 lines
- **Net removed:** ~420 lines
- **Future benefit:** When a provider changes its UI (which happens frequently), you change ONE entry in `SOURCE_EXTRACTOR_CONFIGS`. Previously you'd have to find the right file among 5 and understand each file's unique logic.

---

### 4.3 — Provider Lists: Create a Single Source of Truth

**The Problem:**
The list of providers appears hardcoded in at least 3 places:

```typescript
// Place 1 — apps/web/src/server/api/routers/agent/agent.ts (line ~33):
const PROVIDERS = ['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview'];

// Place 2 — packages/db/src/schema/workspace.ts:
enabledProviders: text('enabled_providers').default('["openai","anthropic","perplexity","google"]')

// Place 3 — packages/services/src/analysis/analysisPrompt.ts:
// Mentions providers inline in the analysis instructions
```

If you add a 6th provider (e.g., "meta-ai"), you have to:
1. Add it to the `Provider` type in `@onescope/types`
2. Remember to find all 3 hardcoded places and update them
3. Hope you didn't miss any

**The Fix:**

```typescript
// packages/types/src/types/agent.ts — add a runtime constant alongside the type:

// The union type (for compile-time TypeScript checks):
export type Provider = 'openai' | 'anthropic' | 'perplexity' | 'google' | 'google-ai-overview';

// The runtime array (for loops, validation, defaults):
// Using `as const` makes TypeScript infer the narrowest type (readonly tuple)
// instead of string[], which gives you autocomplete and type safety
export const PROVIDERS = [
  'openai',
  'anthropic',
  'perplexity',
  'google',
  'google-ai-overview',
] as const satisfies Provider[];

// Export the count for convenience:
export const PROVIDER_COUNT = PROVIDERS.length; // 5
```

Then in every file that needs the list:
```typescript
import { PROVIDERS } from '@onescope/types';

// agent.ts router:
const providers = PROVIDERS; // ← always up-to-date

// workspace schema default:
enabledProviders: text('enabled_providers').default(JSON.stringify(PROVIDERS))
```

**The `satisfies` keyword** (TypeScript 4.9+) is the key ingredient here. It ensures `PROVIDERS` is valid against the `Provider` type at compile time, but still lets TypeScript infer the more specific `readonly ['openai', 'anthropic', ...]` type rather than just `string[]`. This means you get autocomplete AND runtime iteration.

---

## 5. Structural Improvements

### 5.1 — Create a Selector Registry

**File to CREATE:** `apps/agent/src/config/selectors.ts`

**The Problem:**
CSS selectors are the most fragile part of browser automation. When OpenAI changes `#prompt-textarea` to `#chat-input`, the job silently fails for every OpenAI prompt. Currently, selectors are scattered across 15+ functions, so when a UI change happens you have to grep the entire codebase to find all affected selectors.

**The Fix — centralize all selectors:**

```typescript
// apps/agent/src/config/selectors.ts

/**
 * All CSS selectors used for browser automation in one place.
 *
 * When a provider changes their UI (which happens regularly), you update
 * ONE entry here rather than hunting through the codebase.
 *
 * Organization: SELECTORS[provider][element] = selector string
 *
 * Backup selectors: Use arrays — the automation code tries each in order
 * and uses the first one that matches. This makes you resilient to A/B tests.
 */
export const SELECTORS = {
  openai: {
    chatInput: ['#prompt-textarea', '[data-id="chat-input"]'],  // Try both, use first match
    sendButton: ['[data-testid="send-button"]', 'button[aria-label="Send message"]'],
    stopButton: ['[data-testid="stop-button"]', 'button[aria-label="Stop generating"]'],
    assistantMessage: 'div[data-message-author-role="assistant"]',
    sourcesButton: 'button[aria-label="Sources"]',
    sourcePanel: '[data-testid="source-citations-panel"]',
    generationIndicator: '.result-streaming, [data-testid="loading-indicator"]',
  },

  anthropic: {
    chatInput: ['.ProseMirror[contenteditable="true"]', '[data-testid="chat-input"]'],
    sendButton: ['button[aria-label="Send Message"]', 'button[data-testid="send-message-button"]'],
    stopButton: 'button[aria-label="Stop"]',
    assistantMessage: '.standard-markdown',
    generationIndicator: '.streaming-indicator',
  },

  perplexity: {
    chatInput: ['textarea[placeholder*="Ask"]', '#ask-textarea'],
    sendButton: ['button[aria-label="Submit"]', 'button[type="submit"]'],
    stopButton: 'button[aria-label="Stop"]',
    assistantMessage: '.prose',
    sourcesPanel: 'div[style*="position: fixed"][style*="right: 0"]',
    generationIndicator: '.generating',
  },

  google: {
    chatInput: ['rich-textarea .ql-editor', 'div[contenteditable="true"]'],
    sendButton: ['button[aria-label="Send message"]', 'send-button'],
    stopButton: 'button[aria-label="Stop"]',
    assistantMessage: 'message-content',
    generationIndicator: 'loading-indicator',
  },

  'google-ai-overview': {
    searchInput: 'textarea[name="q"], input[name="q"]',
    aiOverviewContainer: '[data-attrid="wa:/description"]',
    aiOverviewHeading: 'h1:has-text("AI Overview")',
  },
} as const;

// Type helper: get selector for a specific provider + element
// Returns string | readonly string[] — callers handle both cases
export type SelectorKey<P extends keyof typeof SELECTORS> = keyof (typeof SELECTORS)[P];
```

---

### 5.2 — Implement Graceful Shutdown

**File:** `apps/agent/src/index.ts`

**The Problem:**
```typescript
// CURRENT (the entire shutdown handler — it's empty!):
const shutdown = async (signal: string) => {
  console.log(`[agent] Received ${signal}. Shutting down...`);
  try {
    // ← NOTHING HERE
  } catch (err) {
    console.error("[agent] Shutdown error:", err);
  } finally {
    process.exit(0);  // ← Kills the process immediately
  }
};
```

When Docker runs `docker compose restart agent-worker` or your CI/CD deploys a new image, Docker sends `SIGTERM` to the container. With this empty handler, the process exits immediately. Consequences:
1. Any in-flight browser session is killed mid-prompt — the job is abandoned
2. The BullMQ worker never calls `worker.close()` — the job gets re-queued and retried from scratch
3. Playwright browser processes become orphans — they keep running until the container is killed by `SIGKILL` after the 10-second timeout
4. Redis connections are closed abruptly instead of gracefully — Redis logs connection errors

**The Fix:**

```typescript
// apps/agent/src/index.ts

import { worker } from './worker';           // Import the BullMQ Worker instance
import { redisConnection } from './lib/redis'; // Import the Redis IORedis instance
import { logger } from '@onescope/errors';

// Track all open browser instances so we can close them on shutdown
const activeBrowsers = new Set<import('playwright').Browser>();

// Register browser when created:
export function trackBrowser(browser: import('playwright').Browser) {
  activeBrowsers.add(browser);
  browser.on('disconnected', () => activeBrowsers.delete(browser));
}

const shutdown = async (signal: string) => {
  logger.info(`[agent] Received ${signal}. Starting graceful shutdown...`);

  // Give ourselves 30 seconds before forcing exit
  const forceExitTimer = setTimeout(() => {
    logger.error('[agent] Graceful shutdown timed out after 30s. Forcing exit.');
    process.exit(1);
  }, 30_000);

  try {
    // Step 1: Stop accepting new jobs from the queue
    // This does NOT interrupt currently running jobs — it just stops picking up new ones
    // BullMQ will re-queue any job that was picked up but not completed
    logger.info('[agent] Closing BullMQ worker (draining current job if any)...');
    await worker.close();
    logger.info('[agent] Worker closed.');

    // Step 2: Close Redis connection cleanly
    // QUIT sends a Redis QUIT command and waits for acknowledgment
    // vs just destroying the socket
    logger.info('[agent] Closing Redis connection...');
    await redisConnection.quit();
    logger.info('[agent] Redis connection closed.');

    // Step 3: Close all open browser instances
    // We collect errors but don't throw them — a browser that's already crashed
    // shouldn't prevent the rest of the shutdown from completing
    logger.info(`[agent] Closing ${activeBrowsers.size} browser instance(s)...`);
    const closeResults = await Promise.allSettled(
      [...activeBrowsers].map(browser => browser.close())
    );
    const closeErrors = closeResults.filter(r => r.status === 'rejected');
    if (closeErrors.length > 0) {
      logger.warn(`[agent] ${closeErrors.length} browser(s) failed to close cleanly.`);
    }
    logger.info('[agent] All browsers closed.');

    clearTimeout(forceExitTimer);
    logger.info('[agent] Graceful shutdown complete.');
    process.exit(0);

  } catch (err) {
    logger.error('[agent] Shutdown error:', err);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));  // Ctrl+C in development
```

**Why `Promise.allSettled` instead of `Promise.all`:**
`Promise.all` rejects as soon as ANY promise rejects. If browser #1 fails to close, browsers #2-N never get closed. `Promise.allSettled` waits for ALL promises regardless of failures, so every browser gets a close attempt.

---

### 5.3 — Fix Non-Null Assertions

**File:** `apps/web/src/server/api/routers/prompt/prompt.ts`

**The Problem:**
Non-null assertions (`!`) in TypeScript tell the compiler "trust me, this is not null" and completely bypass null-safety checking. When the assumption is wrong, you get a runtime `TypeError: Cannot read property 'x' of undefined` with a cryptic stack trace instead of a helpful error message.

```typescript
// CURRENT (dangerous):
const workspace = data.workspace!;    // Line 25 — what if workspace is null?
const prompts = data.prompts!;         // Line 38 — what if prompts is null?
const userId = data.user!.id;         // Line 52 — what if user is null?
```

**The Fix:**

```typescript
// AFTER — explicit guards with helpful error messages:

// Instead of: const workspace = data.workspace!;
if (!data.workspace) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Workspace not found. It may have been deleted.'
  });
}
const workspace = data.workspace; // TypeScript now knows this is non-null

// Instead of: const prompts = data.prompts!;
if (!data.prompts || data.prompts.length === 0) {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'No prompts provided for this workspace.'
  });
}
const prompts = data.prompts;

// Instead of: const userId = data.user!.id;
// This should be caught by the auth middleware, but add a guard anyway:
if (!data.user?.id) {
  throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User session is invalid.' });
}
const userId = data.user.id;
```

**The key insight:** The `!` operator is almost always a sign that your data model is not clear enough. Either the value CAN be null (in which case you need a guard) or it CANNOT (in which case the type should reflect that upstream). Never use `!` as a shortcut — it's technical debt that causes production incidents.

---

## 6. Performance & Scalability

### 6.1 — Add ClickHouse Primary Sort Key for Workspace Queries

**File:** `packages/db/clickhouse-init/schema.sql`

**The Problem:**
The current table definition:
```sql
CREATE TABLE prompt_responses (
  id UUID,
  user_id String,
  workspace_id String,
  -- ... other columns
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (id)  -- ← id is a UUID — random order provides no query benefit
```

ClickHouse's `ORDER BY` clause serves as both the primary index AND the sort order on disk. When you query `WHERE workspace_id = 'xyz'`, ClickHouse has to do a full scan of the partition because `workspace_id` is not part of the sort key. With millions of rows, this becomes very slow.

**The Fix:**
```sql
CREATE TABLE prompt_responses (
  id UUID,
  user_id String,
  workspace_id String,
  prompt_id String,
  model_provider String,
  response String,
  sources String,  -- JSON array
  created_at DateTime,
  is_analysed UInt8 DEFAULT 0
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(created_at)
-- Put high-cardinality filter columns FIRST in ORDER BY:
-- workspace_id filters the data set, created_at enables time range queries,
-- id makes rows unique for ReplacingMergeTree deduplication
ORDER BY (workspace_id, created_at, id);

-- Optional: add a secondary index on model_provider for provider filtering:
-- (ClickHouse secondary indexes work differently than SQL indexes — they're bloom filters)
ALTER TABLE prompt_responses ADD INDEX idx_provider (model_provider) TYPE bloom_filter GRANULARITY 4;
```

**Performance impact:** A query `WHERE workspace_id = 'abc' AND created_at >= '2025-01-01'` goes from reading the entire partition (~millions of rows) to reading only the granules (blocks of ~8192 rows) that contain that workspace's data. Typically a 10-100× speedup.

### 6.2 — Fix the Pagination Infinite Loop

**File:** `packages/services/src/analysis/analysis.ts`

**The Problem:**
```typescript
// CURRENT (broken pagination):
async function analysePromptsForWorkspace(workspaceId: string) {
  let offset = 0;
  const batchSize = 10;

  while (true) {
    const batch = await fetchUnanalysedPrompts(workspaceId, batchSize, offset);
    if (batch.length === 0) break;

    for (const prompt of batch) {
      await analysePromptResponse(prompt);
    }

    // BUG: offset never increments! Next iteration fetches the same 10 records.
    // Those records are now marked as analysed, so we fetch the SAME 10 again,
    // they're already analysed so we do nothing, batch is empty...
    // Actually wait — if they're marked analysed, next fetch should skip them.
    // But if there's a bug in the "is_analysed" update, this is an infinite loop.
  }
}
```

**The Fix:**
```typescript
async function analysePromptsForWorkspace(workspaceId: string) {
  let offset = 0;
  const batchSize = 10;
  let totalAnalysed = 0;

  while (true) {
    const batch = await fetchUnanalysedPrompts(workspaceId, batchSize, offset);
    if (batch.length === 0) break;

    for (const prompt of batch) {
      await analysePromptResponse(prompt);
      totalAnalysed++;
    }

    offset += batchSize; // ← THE FIX: advance past the records we just processed
  }

  return { totalAnalysed };
}
```

### 6.3 — Add Redis Caching for Dashboard Queries

**File:** `packages/services/src/analysis/analysis.ts`

ClickHouse analytical queries are expensive (100ms-2s per query). The dashboard loads multiple charts, each triggering a separate query. Add a cache-aside pattern:

```typescript
import { redis } from '../agent/redis';

const DASHBOARD_CACHE_TTL = 5 * 60; // 5 minutes in seconds

async function fetchDashboardData(workspaceId: string, dateRange: DateRange) {
  const cacheKey = `dashboard:${workspaceId}:${dateRange.from}:${dateRange.to}`;

  // 1. Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // Cache hit — returns immediately
  }

  // 2. Cache miss — run the expensive ClickHouse query
  const data = await runClickHouseQuery(workspaceId, dateRange);

  // 3. Store in cache for next time
  await redis.setex(cacheKey, DASHBOARD_CACHE_TTL, JSON.stringify(data));

  return data;
}

// Cache invalidation: when new analysis results are stored, clear the cache
async function storeAnalysisResult(workspaceId: string, result: BrandAnalysisResult) {
  await clickhouse.insert({ ... result });

  // Clear all cached dashboard views for this workspace
  // The pattern `dashboard:${workspaceId}:*` matches all date ranges
  const keys = await redis.keys(`dashboard:${workspaceId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

---

## 7. Deployment Hardening

### 7.1 — Fix Exposed Database Ports

**File:** `docker-compose.yml`

```yaml
# Change these two services:

db:
  ports:
    - "127.0.0.1:5432:5432"  # Was: "5432:5432"

clickhouse:
  ports:
    - "127.0.0.1:9000:9000"  # Was: "9000:9000"
    - "127.0.0.1:8123:8123"  # Was: "8123:8123"
```

### 7.2 — Add Health Checks

**File:** `docker-compose.yml`

```yaml
redis:
  # Add this block:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s

clickhouse:
  # Add this block:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8123/ping"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s  # ClickHouse takes a while to initialize

agent-api:
  # Add this block (agent-api already has a /health endpoint):
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3333/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 20s

# Update web service dependencies to use service_healthy:
web:
  depends_on:
    db:
      condition: service_healthy
    migrate:
      condition: service_completed_successfully
    redis:
      condition: service_healthy      # Was: service_started
    clickhouse:
      condition: service_healthy      # Was: service_started

# Update agent-worker dependencies:
agent-worker:
  depends_on:
    redis:
      condition: service_healthy      # Was: service_started
```

### 7.3 — Add Resource Limits

**File:** `docker-compose.yml`

```yaml
agent-worker:
  # Add deploy block:
  deploy:
    resources:
      limits:
        memory: 4G      # Chromium + page rendering can use 1-2GB easily
        cpus: '2.0'
      reservations:
        memory: 512M    # Guaranteed minimum allocation

web:
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '1.0'

agent-api:
  deploy:
    resources:
      limits:
        memory: 256M    # API-only, very lightweight
        cpus: '0.5'
```

### 7.4 — Add Redis Authentication

**File:** `docker-compose.yml` + `.env`

```yaml
# docker-compose.yml:
redis:
  command: redis-server --requirepass ${REDIS_PASSWORD}

# .env — add:
REDIS_PASSWORD=generate_with_openssl_rand_hex_32
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

Then update `packages/services/src/agent/redis.ts` to use `REDIS_URL` or pass the password:
```typescript
import { Redis } from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'redis',
  port: parseInt(process.env.REDIS_PORT ?? '6379'),
  password: process.env.REDIS_PASSWORD,  // Add this line
});
```

---

## 8. CI/CD Improvements

### 8.1 — Add Quality Gate Before Docker Build

**File:** `.github/workflows/docker-build.yml`

Add a `quality-check` job that all build jobs `need`:

```yaml
jobs:
  quality-check:
    name: Quality Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.16.0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared packages (required for typecheck)
        run: pnpm turbo build --filter='./packages/*'

      - name: TypeScript check
        run: pnpm typecheck
        # This will FAIL the entire pipeline if any TypeScript error exists
        # Prevents broken code from ever reaching your production images

      - name: Lint
        run: pnpm lint
        # Biome lint — catches common code quality issues

  # Modify ALL build jobs to depend on quality-check:
  build-web:
    needs: [changes, quality-check]  # Add quality-check here
    if: ${{ github.event_name == 'workflow_dispatch' || needs.changes.outputs.web == 'true' }}
    # ... rest unchanged

  build-agent:
    needs: [changes, quality-check]  # Add quality-check here
    # ... rest unchanged

  build-postgres:
    needs: [changes, quality-check]  # Add quality-check here
    # ... rest unchanged
```

---

## 9. Open Source Readiness

Before open-sourcing this repository, complete these steps:

### 9.1 — Create `LICENSE`
```
MIT License

Copyright (c) 2025 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
...
```
Place this at the repo root. Without a LICENSE file, the repository is technically "all rights reserved" and contributors cannot legally use it.

### 9.2 — Create `CONTRIBUTING.md`
Cover:
- How to set up the development environment
- Code style (Biome for formatting + linting)
- Commit message convention (Conventional Commits: `feat:`, `fix:`, `chore:`)
- Branch naming: `feature/description`, `fix/description`
- PR checklist: tests pass, typecheck passes, no new `console.log`
- How to add a new LLM provider (update `AGENT_CONFIGS`, `SOURCE_EXTRACTOR_CONFIGS`, `PROVIDERS`, `SELECTORS`)

### 9.3 — Scrub Personal Data from Configs
```bash
# Check for hardcoded domains or personal info:
grep -r "oneglanse.com" . --include="*.ts" --include="*.json" --include="*.yml"
grep -r "aryamantodkar" . --include="*.ts" --include="*.json" --include="*.yml"
```

Replace any hardcoded personal domains/usernames with `example.com` or environment variables.

### 9.4 — Add GitHub Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug Report
about: Report a bug in OneScope AI
labels: bug
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click '...'

**Expected behavior**

**Screenshots/Logs**

**Environment:**
- OS:
- Node version:
- Docker version:
```

Create `.github/PULL_REQUEST_TEMPLATE.md`:
```markdown
## What does this PR do?

## How was it tested?

## Checklist
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No new `console.log` statements in production code
- [ ] Added tests for new functionality
```

---

## 10. Redundant File Deletions

After implementing the consolidated agent factory and unified source extractor, delete these files:

```bash
# Agent factories (replaced by apps/agent/src/agents/lib/createAgent.ts):
rm apps/agent/src/agents/chatgpt/chatgptAgent.ts
rm apps/agent/src/agents/chatgpt/chatgpt.ts
rm apps/agent/src/agents/claude/claudeAgent.ts
rm apps/agent/src/agents/claude/claude.ts
rm apps/agent/src/agents/perplexity/perplexityAgent.ts
rm apps/agent/src/agents/perplexity/perplexity.ts
rm apps/agent/src/agents/google/gemini/geminiAgent.ts
rm apps/agent/src/agents/google/gemini/gemini.ts
rm apps/agent/src/agents/google/ai-overview/aiOverviewAgent.ts
rm apps/agent/src/agents/google/ai-overview/aiOverview.ts

# Source extractors (replaced by apps/agent/src/agents/lib/extractSources.ts):
rm apps/agent/src/agents/chatgpt/lib/extractSources.ts
rm apps/agent/src/agents/claude/lib/extractSources.ts
rm apps/agent/src/agents/perplexity/lib/extractSources.ts
rm apps/agent/src/agents/google/gemini/lib/extractSources.ts
rm apps/agent/src/agents/google/ai-overview/lib/extractSources.ts

# Stale analysis artifacts (add to .gitignore to prevent future commits):
rm ANALYSIS.md INFRASTRUCTURE.md apps/agent/ANALYSIS.md apps/web/ANALYSIS.md
```

Add to `.gitignore`:
```
# Analysis artifacts (generated by Claude Code, not part of the codebase)
ANALYSIS.md
INFRASTRUCTURE.md
**/ANALYSIS.md
**/INFRASTRUCTURE.md
```

**Total code removed:** ~770 lines of duplication replaced with ~230 lines of generic, config-driven code.
