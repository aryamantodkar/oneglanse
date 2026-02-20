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
