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

## 6. Performance & Scalability

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