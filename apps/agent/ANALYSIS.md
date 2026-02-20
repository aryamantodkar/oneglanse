# Agent App — Detailed Analysis

> **No code was changed. This document is for review only.**
> See root [`ANALYSIS.md`](../../ANALYSIS.md) for the cross-codebase priority matrix.

---

## Architecture Overview

The agent is a **dual-process application** run from `src/index.ts`:

```
index.ts
├── api.ts          — HTTP server on port 3333
│   ├── POST /upload-sessions   (auth file upload)
│   └── GET  /health
└── worker.ts       — BullMQ worker consuming Redis queues
    └── agentHandler.ts → runPrompts.ts → [provider]/steps/
```

**Provider implementations** live in `src/agents/`:
```
agents/
├── openai/       — ChatGPT automation
├── anthropic/    — Claude.ai automation
├── perplexity/   — Perplexity.ai automation
├── google/       — Google Search automation
├── ai-overview/  — Google AI Overview extraction
└── lib/          — Shared: agentHandler, runPrompts, steps/
```

**Browser automation flow:**
1. Worker receives job from Redis queue
2. `agentHandler.ts` picks a proxy, launches a new browser context
3. Loads saved auth state from `/storage/<provider>/state.json`
4. Calls `runPrompts.ts` which iterates through each prompt
5. Per prompt: `askPrompt.ts` types + submits, `waitForAssistantToFinish.ts` polls, `extractResponse.ts` + `extractSources.ts` harvest
6. Results stored to DB; browser context closed; proxy scored

## Security #3 — Path Traversal on Auth File Write ⚠️ CRITICAL

**Severity:** CRITICAL
**File:** `src/api.ts:54`

```typescript
const providerDir = path.join(VPS_AUTH_PROFILE_PATH, provider);
const authFile = path.join(providerDir, `${provider}-auth.json`);
fs.mkdirSync(providerDir, { recursive: true });
fs.writeFileSync(authFile, JSON.stringify(sessions[provider], null, 2));
```

`VPS_AUTH_PROFILE_PATH` comes from an environment variable and is never validated. `provider` is iterated from a hardcoded list (so that's fine), but the base path itself is the attack surface.

**Additional issues:**
- No validation that `sessions[provider]` is a plain JSON-safe object
- No file size limit on what's written
- Files written synchronously without atomic replacement (concurrent requests could corrupt)

**Fix:**
```typescript
import path from 'node:path';

const BASE = path.resolve(VPS_AUTH_PROFILE_PATH);
const providerDir = path.resolve(BASE, provider);

// Prevent path traversal
if (!providerDir.startsWith(BASE + path.sep)) {
  throw new Error('Path traversal detected');
}

// Validate and size-limit the payload
const payload = sessions[provider];
const json = JSON.stringify(payload, null, 2);
if (json.length > 1_000_000) throw new Error('Auth payload too large');

// Atomic write
const tmp = authFile + '.tmp';
fs.writeFileSync(tmp, json, { mode: 0o600 });
fs.renameSync(tmp, authFile);
```

---

## Code Quality #1 — Duplicated Source Extraction Logic (5 copies)

**Severity:** MEDIUM
**Files:**
- `src/agents/openai/lib/extractSources.ts`
- `src/agents/perplexity/lib/extractSources.ts`
- `src/agents/anthropic/lib/extractSources.ts`
- `src/agents/google/lib/extractSources.ts`
- `src/agents/ai-overview/lib/extractSources.ts`

Each implementation independently implements:
- URL normalization and deduplication via a `seen` Set
- Domain extraction via `new URL(url).hostname.replace(/^www\./, '')`
- Favicon URL generation: `` `https://www.google.com/s2/favicons?domain=${domain}&sz=32` ``
- Error handling for malformed URLs

This is ~40% repeated code across 5 files.

**Fix:** Create `src/lib/extraction/sourceUtils.ts`:
```typescript
export function getDomain(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, '') ?? null; }
  catch { return null; }
}

export function generateFavicon(domain: string | null): string | null {
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;
}

export function deduplicateSourcesByUrl<T extends { url: string }>(sources: T[]): T[] {
  const seen = new Set<string>();
  return sources.filter(s => {
    const key = s.url.split('#')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

## Code Quality #2 — Two Separate `classifyError()` Functions

**Severity:** MEDIUM
**Files:**
- `src/agents/lib/agentHandler.ts` (one implementation)
- `src/agents/lib/runPrompts.ts` (another implementation)

Both functions map error message strings to a `FailureType` enum for proxy scoring, but with different regex patterns and slightly different categorizations. The proxy scoring system receives inconsistent classification inputs depending on where the error originates.

**Fix:** Consolidate into `src/lib/errors/classifyError.ts` and import from both files.

---

## Code Quality #3 — Unsafe Type Casting

**Severity:** LOW
**File:** `src/agents/lib/agentHandler.ts:129`

```typescript
const failureType = (err.failureType as FailureType) ?? classifyError(err);
```

`err.failureType` is cast directly without verifying it's a valid `FailureType` value.

**Fix:**
```typescript
const VALID_FAILURE_TYPES: FailureType[] = ['rate_limited', 'bot_detection', 'connection_error', 'logged_out', 'no_editor', 'extraction_failed'];

function isFailureType(v: unknown): v is FailureType {
  return VALID_FAILURE_TYPES.includes(v as FailureType);
}

const failureType = isFailureType(err?.failureType) ? err.failureType : classifyError(err);
```

---

## Performance #1 — Infinite Page Timeouts

**Severity:** MEDIUM
**File:** `src/lib/browser/setupPage.ts:11-12`

```typescript
page.setDefaultTimeout(0);
page.setDefaultNavigationTimeout(0);
```

Setting these to `0` disables all Playwright timeouts. A page navigation or selector wait that never resolves will hang the worker process indefinitely, starving the job queue.

**Fix:**
```typescript
const PAGE_TIMEOUT = Number(process.env.PAGE_TIMEOUT_MS ?? 60_000);
page.setDefaultTimeout(PAGE_TIMEOUT);
page.setDefaultNavigationTimeout(PAGE_TIMEOUT);
```

---

## Performance #2 — Browser Cleanup Silently Swallows Errors

**Severity:** HIGH
**File:** `src/agents/lib/agentHandler.ts:152-154`

```typescript
await refs.context?.close().catch(() => {});
await refs.browser?.close().catch(() => {});
logger.debug(`${label} browser instance closed successfully.`);
```

The logger says "closed successfully" even if `close()` threw. If Playwright fails to close a browser (e.g., crash or zombie process), the error is silently discarded and Chromium accumulates in the background.

**Fix:**
```typescript
} finally {
  const CLOSE_TIMEOUT = 10_000;
  try {
    await Promise.race([
      refs.context?.close(),
      new Promise((_, r) => setTimeout(() => r(new Error('context close timeout')), CLOSE_TIMEOUT))
    ]);
  } catch (e) {
    logger.warn(`${label} context close failed: ${e?.message}`);
  }
  try {
    await Promise.race([
      refs.browser?.close(),
      new Promise((_, r) => setTimeout(() => r(new Error('browser close timeout')), CLOSE_TIMEOUT))
    ]);
  } catch (e) {
    logger.warn(`${label} browser close failed: ${e?.message}`);
  }
}
```

---

## Performance #3 — Redis Connection Never Closed

**Severity:** MEDIUM
**Files:** `src/worker.ts`, `src/index.ts`

The Redis client is created on startup but `redis.quit()` is never called. The shutdown handler in `index.ts` has an empty `try` block with no actual cleanup. On SIGTERM, the process exits with open handles.

**Fix — add to `index.ts` shutdown handler:**
```typescript
const shutdown = async (signal: string) => {
  logger.log(`[agent] Received ${signal}. Shutting down...`);
  try {
    await worker.close();  // drain BullMQ
    await redis.quit();    // close Redis
    logger.log('[agent] Clean shutdown complete.');
  } catch (err) {
    logger.error('[agent] Shutdown error:', err);
  } finally {
    process.exit(0);
  }
};
```

---

## Performance #4 — Proxy Pool Never Cleaned Up

**Severity:** LOW
**File:** `src/lib/browser/proxyPool.ts`

The `proxyRecords` Map grows unbounded. With a large rotating proxy list, records for dead proxies accumulate in memory indefinitely. Each record stores up to 20 events. With 10,000 proxies this is ~4MB of stale state.

**Fix:** Add a periodic cleanup interval:
```typescript
setInterval(() => {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24h
  for (const [key, record] of proxyRecords) {
    const lastEvent = record.events.at(-1);
    if (!lastEvent || lastEvent.timestamp < cutoff) {
      proxyRecords.delete(key);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes
```

---

## Missing Validation #1 — Job Payload Not Validated

**Severity:** MEDIUM
**File:** `src/worker.ts:80-82`

Only prompt array length is checked:
```typescript
if (!prompts || prompts.length === 0) {
  throw new Error("Agent job received no prompts");
}
```

There is no validation that:
- `user_id` and `workspace_id` are non-empty strings
- `jobGroupId` is a valid UUID
- Each prompt has a valid `id` and non-empty `prompt` text
- Prompt text doesn't exceed reasonable length limits

**Fix — use Zod:**
```typescript
import { z } from 'zod';

const ProviderJobDataSchema = z.object({
  jobGroupId: z.string().uuid(),
  provider: z.enum(['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview']),
  prompts: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1).max(10_000),
  })).min(1),
  user_id: z.string().min(1),
  workspace_id: z.string().min(1),
  executionTime: z.string().datetime(),
});

const PromptPayload = ProviderJobDataSchema.parse(job.data);
```

---

## Missing Validation #2 — Health Check Only Checks File Existence

**Severity:** LOW
**File:** `src/api.ts:82-109`

The health endpoint reports session status based on `fs.existsSync()`. A corrupted JSON file, an expired session, or an empty file all appear "healthy".

**Improvements:**
```typescript
function validateSession(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return typeof data === 'object' && data !== null && Array.isArray(data.cookies);
  } catch {
    return false;
  }
}
```

---

## Race Condition #1 — Redis Progress Update TOCTOU

**Severity:** LOW
**File:** `src/worker.ts:124-191`

The progress tracking pattern is read-modify-write without a transaction:

```typescript
const progress = await ensureProgress();   // READ
progress.providers[provider] = "running";  // MODIFY (in memory)
await redis.set(progressKey, JSON.stringify(progress)); // WRITE
// ... do work ...
const progress2 = // (same stale progress object from before)
progress2.providers[provider] = "completed";
await redis.set(progressKey, JSON.stringify(progress2)); // OVERWRITES any concurrent updates
```

If two providers complete nearly simultaneously, one update can overwrite the other's completion status.

**Fix:** Use Redis atomic operations:
```typescript
// Use WATCH + MULTI/EXEC for optimistic locking, or
// Use individual HSET fields per provider instead of one JSON blob
await redis.hset(progressKey, provider, 'completed');
await redis.expire(progressKey, 3600);
```

---

## Summary Table

| # | Severity | Type | File | Issue |
|---|----------|------|------|-------|
| C2 | CRITICAL | Bug | `ai-overview/lib/extractResponse.ts:10` | Regex double-escape, pattern never matches |
| C4 | CRITICAL | Security | `api.ts:54` | Path traversal on auth file write |
| H3 | HIGH | Security | `api.ts:15` | Timing attack on API token comparison |
| H4 | HIGH | Security | `google/auth/validateAuth.ts:62` | Debug screenshots contain auth data |
| H5 | HIGH | Performance | `agents/lib/agentHandler.ts:152` | Browser cleanup silently swallows errors |
| H6 | HIGH | Correctness | `index.ts:4` | Graceful shutdown does nothing |
| B3 | HIGH | Bug | `google/lib/extractSources.ts:12` | Returns `false` instead of `Source[]` |
| B4 | MEDIUM | Bug | `lib/input/waitForAssistantToFinish.ts:45` | elapsed == stableFor (wrong var) |
| B5 | MEDIUM | Bug | `api.ts:29` | Double response after req.destroy() |
| M1 | MEDIUM | Security | `lib/browser/launchContext.ts:42` | Proxy credentials logged |
| M2 | MEDIUM | Quality | Multiple extractSources.ts | 5x duplicated extraction logic |
| M3 | MEDIUM | Quality | agentHandler + runPrompts | Two classifyError() functions |
| M8 | MEDIUM | Performance | `lib/browser/setupPage.ts:11` | Infinite page timeouts |
| M9 | MEDIUM | Performance | worker.ts + index.ts | Redis connection never closed |
| L1 | LOW | Quality | openai + perplexity extractSources.ts | Typos in function names |
| L3 | LOW | Performance | `lib/browser/proxyPool.ts` | Proxy pool Map never cleaned up |
| — | LOW | Quality | agentHandler.ts:129 | Unsafe FailureType cast |
| — | LOW | Validation | worker.ts:80 | Job payload not validated |
| — | LOW | Race | worker.ts:124 | TOCTOU on progress updates |
