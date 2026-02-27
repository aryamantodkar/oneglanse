# OneGlanse — Complete Testing Guide

This guide takes you from **zero tests** to a fully tested, production-grade monorepo. Every section explains the *why* behind each decision, not just the *what*. By the end, you'll understand how to write tests at every layer of the stack.

---

## Table of Contents

1. [Why Testing Matters for This Codebase Specifically](#1-why-testing-matters-for-this-codebase-specifically)
2. [Testing Philosophy & The Test Pyramid](#2-testing-philosophy--the-test-pyramid)
3. [Choosing the Right Tools](#3-choosing-the-right-tools)
4. [Setup: Adding Vitest to the Monorepo](#4-setup-adding-vitest-to-the-monorepo)
5. [Unit Tests for `packages/utils`](#5-unit-tests-for-packagesutils)
6. [Unit Tests for `packages/errors`](#6-unit-tests-for-packageserrors)
7. [Unit Tests for `apps/agent` Core Logic](#7-unit-tests-for-appsagent-core-logic)
8. [Integration Tests for `packages/services`](#8-integration-tests-for-packagesservices)
9. [Integration Tests for tRPC Routers](#9-integration-tests-for-trpc-routers)
10. [E2E Tests with Playwright](#10-e2e-tests-with-playwright)
11. [Test Data Management & Fixtures](#11-test-data-management--fixtures)
12. [Mocking Strategies](#12-mocking-strategies)
13. [CI Integration](#13-ci-integration)
14. [Coverage Requirements](#14-coverage-requirements)
15. [Test Naming Conventions](#15-test-naming-conventions)

---

## 1. Why Testing Matters for This Codebase Specifically

OneGlanse is uniquely vulnerable to undetected failures for these reasons:

**Browser automation is fragile by nature.** When ChatGPT changes their UI — which happens every few weeks — your source extractor silently returns empty arrays instead of citations. Without tests that assert "this function returns at least one citation for this known HTML structure," you only discover the breakage when a customer reports that their sources dashboard is empty.

**5 LLM providers means 5× the surface area for bugs.** Currently, the source extractors for OpenAI, Anthropic, Perplexity, Google Gemini, and Google AI Overview are all separate files. A bug fixed in one file is often missed in the others. Tests would catch this immediately: run the same test suite against all 5 providers, see which ones fail.

**The proxy scoring system is pure algorithmic logic.** `proxyPool.ts` implements a sophisticated scoring algorithm with exponential decay and failure classification. This is exactly the kind of code that benefits enormously from unit tests — it has clear inputs, clear outputs, and complex internal logic that's easy to break during refactoring.

**ClickHouse queries have no compile-time safety.** SQL strings are just strings to TypeScript. A test that runs the actual query against a test database catches malformed SQL, wrong column names, and missing indexes before they reach production.

**tRPC procedures are the API contract.** Every tRPC mutation and query is callable by the frontend. Without tests for auth middleware, UNAUTHORIZED errors might be missing, allowing unauthenticated access to workspace data.

---

## 2. Testing Philosophy & The Test Pyramid

The test pyramid is a ratio guide for how many tests of each type to write:

```
         /\
        /  \
       / E2E \        ← 10% of tests (slowest, most expensive, catch UX bugs)
      /--------\
     / Integra- \     ← 20% of tests (medium speed, catch data flow bugs)
    /   tion     \
   /--------------\
  /   Unit Tests   \  ← 70% of tests (fastest, cheapest, catch logic bugs)
 /------------------\
```

**For OneGlanse specifically:**
- **Unit tests:** Test pure functions — domain extraction, URL normalization, date formatting, proxy scoring, deduplication, markdown conversion rules, error class hierarchy
- **Integration tests:** Test functions that hit the database — storePromptsForWorkspace, analysePromptsForWorkspace, workspace CRUD operations, tRPC routers with real database
- **E2E tests:** Test critical user flows in a real browser — login → create workspace → submit prompt → view dashboard

**The golden rule:** A test should fail for exactly ONE reason. If a unit test fails, it should tell you precisely which function is broken. If it can fail because the database is down OR because the function is broken, it's an integration test masquerading as a unit test.

---

## 3. Choosing the Right Tools

### Why Vitest (not Jest)

This monorepo uses `"type": "module"` in all packages, meaning Node.js treats all `.js` files as ES modules. Jest has historically struggled with ES modules — it requires a transformer like `ts-jest` or `babel-jest` that re-compiles TypeScript before running tests. This is slow (5-15 second startup) and introduces a separate compilation step that can have different behavior than `tsc`.

**Vitest** uses Vite's esbuild-based compilation pipeline:
- Native ES module support — no transformer needed
- 10-50× faster startup than Jest (0.5-1 second vs 5-15 seconds)
- Same API as Jest (`describe`, `it`, `expect`, `vi.mock`, `vi.fn`, etc.)
- First-class pnpm workspace support
- Watch mode that only reruns tests for changed files

### Why Playwright (not Cypress) for E2E

The project already has Playwright installed as a dev dependency for browser automation. Reusing Playwright for E2E tests avoids adding a second browser automation framework. Additionally:
- Playwright's `@playwright/test` is purpose-built for testing (not just automation)
- Better async handling than Cypress
- Can run tests in parallel across multiple workers
- Supports all major browsers (Chromium, Firefox, WebKit)

### Tool Summary

| Layer | Framework | Runner | Assertion |
|-------|-----------|--------|-----------|
| Unit | Vitest | `vitest` | `expect` (Vitest built-in) |
| Integration | Vitest + real DB | `vitest` | `expect` (Vitest built-in) |
| E2E | Playwright Test | `playwright test` | `expect` (Playwright built-in) |

---

## 4. Setup: Adding Vitest to the Monorepo

### Step 1: Install Vitest in each package

```bash
# Add vitest to ALL packages (run from monorepo root):
pnpm --filter @oneglanse/utils add -D vitest
pnpm --filter @oneglanse/errors add -D vitest
pnpm --filter @oneglanse/types add -D vitest

# Services needs coverage too:
pnpm --filter @oneglanse/services add -D vitest @vitest/coverage-v8

# Agent app needs both vitest and some mocking utilities:
pnpm --filter @oneglanse/agent add -D vitest @vitest/coverage-v8

# Web app:
pnpm --filter @oneglanse/web add -D vitest @vitest/coverage-v8 @playwright/test
```

### Step 2: Create `vitest.config.ts` in each package

Each package gets its own Vitest config because their requirements differ (some need a DOM environment, some need database setup, etc.).

**`packages/utils/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' environment = no DOM, just Node.js APIs
    // Good for pure utility functions
    environment: 'node',

    // Run tests in isolated worker threads (parallel)
    pool: 'threads',

    // Show verbose output (test names and timing)
    reporter: ['verbose'],

    // Code coverage configuration:
    coverage: {
      provider: 'v8',        // Uses V8's built-in coverage (fast, accurate)
      reporter: ['text', 'lcov', 'json'],
      thresholds: {
        lines: 90,           // Fail CI if coverage drops below 90%
        functions: 90,
        branches: 85,
      },
    },
  },
});
```

**`packages/services/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

    // IMPORTANT: Integration tests that hit the database MUST run sequentially.
    // If two tests run in parallel and both write to the same workspace,
    // they'll interfere with each other's data and tests will flake.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,    // Run all tests in a single worker (sequential)
      },
    },

    // Run the global setup before any tests (creates test database, runs migrations)
    globalSetup: './src/__tests__/globalSetup.ts',

    // Run per-test setup before each test file (clears database state)
    setupFiles: ['./src/__tests__/testSetup.ts'],

    // Give integration tests more time:
    testTimeout: 30_000,    // 30 seconds per test
    hookTimeout: 60_000,    // 60 seconds for beforeAll/afterAll

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
});
```

### Step 3: Add `test` script to each `package.json`

```json
// packages/utils/package.json:
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",                          // Run once (for CI)
    "test:watch": "vitest",                        // Watch mode (for development)
    "test:coverage": "vitest run --coverage"       // With coverage report
  }
}
```

### Step 4: Add `test` task to `turbo.json`

```json
// turbo.json:
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"],    // Build dependencies before testing
      "outputs": ["coverage/**"], // Cache coverage reports
      "inputs": [                 // Only re-run tests if these files change
        "src/**",
        "vitest.config.ts",
        "tsconfig.json"
      ]
    },
    "test:coverage": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

Now you can run all tests from the root:
```bash
pnpm test                          # Run all tests
pnpm test:coverage                 # Run all tests with coverage
pnpm --filter @oneglanse/utils test # Run only utils tests
```

---

## 5. Unit Tests for `packages/utils`

These are the easiest tests to write — pure functions with clear inputs and outputs, no database, no network.

### File Structure

```
packages/utils/src/
└── __tests__/
    ├── url.test.ts        # getDomain, getUniqueLinks, removeUrlParams
    ├── format.test.ts     # formatDate, formatDateToClickHouse
    ├── extract.test.ts    # extractDomainStats, extractSourceStats
    └── id.test.ts         # ID generation (uniqueness, format)
```

### `url.test.ts` — Full Example

```typescript
// packages/utils/src/__tests__/url.test.ts

import { describe, it, expect } from 'vitest';
import { getDomain } from '../url/getDomain';
import { getUniqueLinks } from '../url/getUniqueLinks';
import { removeUrlParams } from '../url/removeUrlParams';

// describe() groups related tests
// Use the function name as the describe label — makes failures easy to locate
describe('getDomain', () => {

  it('extracts the domain from a standard HTTPS URL', () => {
    // Arrange: prepare the input
    const url = 'https://example.com/some/path?query=1#fragment';

    // Act: call the function under test
    const result = getDomain(url);

    // Assert: verify the output
    expect(result).toBe('example.com');
  });

  it('strips www. prefix', () => {
    expect(getDomain('https://www.example.com')).toBe('example.com');
  });

  it('handles subdomains (does NOT strip them, only www)', () => {
    expect(getDomain('https://api.example.com/v1')).toBe('api.example.com');
  });

  it('handles HTTP (not just HTTPS)', () => {
    expect(getDomain('http://example.com')).toBe('example.com');
  });

  it('returns null for an invalid URL', () => {
    // This is important — makes sure the function handles bad input gracefully
    expect(getDomain('not-a-url')).toBeNull();
    expect(getDomain('')).toBeNull();
    expect(getDomain('javascript:void(0)')).toBeNull();
  });

  it('handles Google redirect URLs (decodes the destination)', () => {
    // Google AI Overview wraps external links as:
    // https://www.google.com/url?q=https://actual-site.com&sa=U
    // We want the ACTUAL domain, not google.com
    const googleRedirect = 'https://www.google.com/url?q=https://github.com/repo&sa=U';
    expect(getDomain(googleRedirect)).toBe('github.com');
  });

  it('handles URLs with ports', () => {
    expect(getDomain('http://localhost:3000/page')).toBe('localhost');
  });

  it('handles deeply nested paths', () => {
    expect(getDomain('https://blog.example.com/2025/01/15/my-post')).toBe('blog.example.com');
  });
});

describe('getUniqueLinks', () => {

  it('deduplicates identical URLs', () => {
    const input = [
      'https://example.com/page',
      'https://example.com/page',  // exact duplicate
      'https://other.com/page',
    ];
    expect(getUniqueLinks(input)).toHaveLength(2);
  });

  it('treats URLs with different fragments as the same link', () => {
    // #:~:text= fragments are added by Google AI Overview and should be ignored
    const input = [
      'https://example.com/page',
      'https://example.com/page#:~:text=some%20highlighted%20text',
    ];
    expect(getUniqueLinks(input)).toHaveLength(1);
  });

  it('treats URLs with different query params as different links', () => {
    const input = [
      'https://example.com/page?tab=1',
      'https://example.com/page?tab=2',
    ];
    expect(getUniqueLinks(input)).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(getUniqueLinks([])).toEqual([]);
  });
});

describe('removeUrlParams', () => {

  it('removes all query parameters', () => {
    const url = 'https://example.com/page?utm_source=email&utm_campaign=launch';
    expect(removeUrlParams(url)).toBe('https://example.com/page');
  });

  it('preserves the path when removing params', () => {
    const url = 'https://example.com/deep/nested/path?param=value';
    expect(removeUrlParams(url)).toBe('https://example.com/deep/nested/path');
  });

  it('returns the original URL if no params exist', () => {
    const url = 'https://example.com/page';
    expect(removeUrlParams(url)).toBe(url);
  });
});
```

### `format.test.ts` — Date Utilities

```typescript
// packages/utils/src/__tests__/format.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate, formatDateToClickHouse } from '../format/date';

describe('formatDate', () => {

  it('formats a Date object as a human-readable string', () => {
    // Create a specific date (not dependent on "today")
    const date = new Date('2025-01-15T10:30:00Z');
    const result = formatDate(date);
    // Assert the expected format — adjust based on what formatDate actually returns
    expect(result).toMatch(/January 15, 2025/);
  });

  it('handles different time zones consistently', () => {
    // Test that the function produces consistent output regardless of local timezone
    const utcDate = new Date('2025-06-01T00:00:00Z');
    expect(formatDate(utcDate)).toBeDefined();
    expect(typeof formatDate(utcDate)).toBe('string');
  });

  it('handles Date edge cases: Jan 1, Dec 31', () => {
    const jan1 = new Date('2025-01-01T12:00:00Z');
    const dec31 = new Date('2025-12-31T12:00:00Z');
    expect(() => formatDate(jan1)).not.toThrow();
    expect(() => formatDate(dec31)).not.toThrow();
  });
});

describe('formatDateToClickHouse', () => {
  // ClickHouse expects dates in 'YYYY-MM-DD HH:MM:SS' format

  it('formats a date in ClickHouse format', () => {
    const date = new Date('2025-03-15T14:30:00Z');
    const result = formatDateToClickHouse(date);
    // Should match: 2025-03-15 14:30:00
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('pads single-digit months and days with zeros', () => {
    const date = new Date('2025-01-05T09:05:00Z');
    const result = formatDateToClickHouse(date);
    expect(result).toContain('2025-01-05');
    expect(result).toContain('09:05:00');
  });
});
```

---

## 6. Unit Tests for `packages/errors`

The error package is small but critical — it's used everywhere. High test coverage here gives you confidence when refactoring.

```typescript
// packages/errors/src/__tests__/safeHandler.test.ts

import { describe, it, expect } from 'vitest';
import { safeHandler, ok, fail } from '../errorHandling';
import {
  ValidationError,
  AuthError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
} from '../error';

describe('ok() helper', () => {
  it('creates a success response with data', () => {
    const result = ok({ id: '123', name: 'Test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '123', name: 'Test' });
    expect(result.status).toBe(200);
  });

  it('accepts custom status codes', () => {
    const result = ok({ created: true }, 201);
    expect(result.status).toBe(201);
  });
});

describe('fail() helper', () => {
  it('creates a failure response', () => {
    const result = fail('Something went wrong', 500);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Something went wrong');
    expect(result.status).toBe(500);
  });
});

describe('safeHandler()', () => {
  // safeHandler wraps an async function and catches any thrown errors,
  // converting them to ApiResponse objects

  it('returns a success response when the handler succeeds', async () => {
    const handler = safeHandler(async () => ({ value: 42 }));
    const result = await handler();
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });
  });

  it('maps ValidationError to HTTP 400', async () => {
    const handler = safeHandler(async () => {
      throw new ValidationError('Email is invalid');
    });
    const result = await handler();
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.message).toContain('Email is invalid');
  });

  it('maps AuthError to HTTP 401', async () => {
    const handler = safeHandler(async () => {
      throw new AuthError('Token expired');
    });
    const result = await handler();
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  it('maps NotFoundError to HTTP 404', async () => {
    const handler = safeHandler(async () => {
      throw new NotFoundError('Workspace not found');
    });
    const result = await handler();
    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
  });

  it('maps RateLimitError to HTTP 429', async () => {
    const handler = safeHandler(async () => {
      throw new RateLimitError('Too many requests');
    });
    const result = await handler();
    expect(result.success).toBe(false);
    expect(result.status).toBe(429);
  });

  it('maps unknown/unhandled errors to HTTP 500', async () => {
    const handler = safeHandler(async () => {
      // A plain Error (not a custom BaseError subclass) is "unhandled"
      throw new Error('Some unexpected database driver error');
    });
    const result = await handler();
    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    // IMPORTANT: the raw error message should NOT be exposed to clients
    // Only a generic message should appear:
    expect(result.message).not.toContain('database driver');
  });

  it('handles non-Error throws (e.g., throw "string" or throw null)', async () => {
    const handler = safeHandler(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'A string was thrown — this is unusual but should be handled';
    });
    const result = await handler();
    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
  });
});
```

---

## 7. Unit Tests for `apps/agent` Core Logic

### 7.1 — Proxy Pool Scoring Tests

The proxy pool implements a sophisticated scoring algorithm. This is pure logic — no browser, no network — and extremely testable.

```typescript
// apps/agent/src/__tests__/proxyPool.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProxyPool } from '../lib/browser/proxyPool';

describe('ProxyPool', () => {
  let pool: ProxyPool;

  beforeEach(() => {
    pool = new ProxyPool();
    // Use fake timers so we can control time in tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with an empty pool', () => {
      expect(pool.size()).toBe(0);
    });

    it('gives all proxies an equal initial score', () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });
      pool.addProxy({ server: 'http://proxy2:9000', username: 'u', password: 'p' });
      pool.addProxy({ server: 'http://proxy3:9000', username: 'u', password: 'p' });

      const scores = pool.getAllScores();
      const uniqueScores = new Set(scores.map(s => s.score));
      expect(uniqueScores.size).toBe(1); // All equal
    });
  });

  describe('failure recording', () => {
    it('reduces score after a bot_detection failure', () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });
      const scoreBefore = pool.getScore('http://proxy1:9000');
      pool.recordFailure('http://proxy1:9000', 'bot_detection');
      const scoreAfter = pool.getScore('http://proxy1:9000');
      expect(scoreAfter.score).toBeLessThan(scoreBefore.score);
    });

    it('applies exponential backoff for repeated bot_detection failures', () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });

      pool.recordFailure('http://proxy1:9000', 'bot_detection');
      const cooldown1 = pool.getScore('http://proxy1:9000').cooldownUntil;

      vi.advanceTimersByTime(60_000); // Wait for first cooldown to expire
      pool.recordFailure('http://proxy1:9000', 'bot_detection');
      const cooldown2 = pool.getScore('http://proxy1:9000').cooldownUntil;

      // Second cooldown should be longer than first (exponential backoff)
      expect(cooldown2 - Date.now()).toBeGreaterThan(cooldown1 - (Date.now() - 60_000));
    });

    it('applies shorter backoff for connection_error than bot_detection', () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });
      pool.addProxy({ server: 'http://proxy2:9000', username: 'u', password: 'p' });

      pool.recordFailure('http://proxy1:9000', 'bot_detection');
      pool.recordFailure('http://proxy2:9000', 'connection_error');

      const cooldown1 = pool.getScore('http://proxy1:9000').cooldownUntil;
      const cooldown2 = pool.getScore('http://proxy2:9000').cooldownUntil;

      // bot_detection should have longer cooldown than connection_error
      expect(cooldown1).toBeGreaterThan(cooldown2);
    });
  });

  describe('success recording', () => {
    it('increases score after a successful use', () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });
      pool.recordFailure('http://proxy1:9000', 'bot_detection');
      const scoreBefore = pool.getScore('http://proxy1:9000').score;

      pool.recordSuccess('http://proxy1:9000');
      const scoreAfter = pool.getScore('http://proxy1:9000').score;

      expect(scoreAfter).toBeGreaterThan(scoreBefore);
    });

    it('resets cooldown after a success', () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });
      pool.recordFailure('http://proxy1:9000', 'rate_limited');
      expect(pool.getScore('http://proxy1:9000').cooldownUntil).toBeGreaterThan(Date.now());

      pool.recordSuccess('http://proxy1:9000');
      // After success, should not be in cooldown
      expect(pool.getScore('http://proxy1:9000').cooldownUntil).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('proxy selection', () => {
    it('selects the highest-scored proxy that is not in cooldown', async () => {
      pool.addProxy({ server: 'http://good:9000', username: 'u', password: 'p' });
      pool.addProxy({ server: 'http://bad:9000', username: 'u', password: 'p' });

      // Put 'bad' proxy in a long cooldown
      pool.recordFailure('http://bad:9000', 'bot_detection');

      const selected = await pool.getBestProxy();
      expect(selected?.server).toBe('http://good:9000');
    });

    it('returns null when all proxies are in cooldown', async () => {
      pool.addProxy({ server: 'http://proxy1:9000', username: 'u', password: 'p' });
      pool.recordFailure('http://proxy1:9000', 'bot_detection');

      // All proxies in cooldown:
      const selected = await pool.getBestProxy();
      expect(selected).toBeNull();
    });
  });
});
```

### 7.2 — Source Deduplication Tests

After you consolidate the 5 source extractors into 1, test the deduplication logic:

```typescript
// apps/agent/src/__tests__/extractSources.test.ts

import { describe, it, expect } from 'vitest';
// Import the dedupeKey functions directly from the config (they're pure functions)
import { buildDedupeKey } from '../agents/lib/extractSources';

describe('source deduplication', () => {
  describe('URL fragment stripping', () => {
    it('treats URLs with and without #:~:text= as the same source', () => {
      const url1 = 'https://example.com/article';
      const url2 = 'https://example.com/article#:~:text=highlighted%20passage';

      // Both should produce the same deduplication key
      expect(buildDedupeKey('google-ai-overview', url1, '', '')).toBe(
        buildDedupeKey('google-ai-overview', url2, '', '')
      );
    });

    it('treats URLs with different paths as different sources', () => {
      const url1 = 'https://example.com/article-1';
      const url2 = 'https://example.com/article-2';

      expect(buildDedupeKey('google-ai-overview', url1, '', '')).not.toBe(
        buildDedupeKey('google-ai-overview', url2, '', '')
      );
    });
  });

  describe('OpenAI strict deduplication', () => {
    it('treats same URL with different cited text as different sources', () => {
      // OpenAI dedupes by href|title|citedText — so same URL with different
      // context excerpts are kept as separate citations
      const key1 = buildDedupeKey('openai', 'https://example.com', 'Title', 'First passage');
      const key2 = buildDedupeKey('openai', 'https://example.com', 'Title', 'Second passage');
      expect(key1).not.toBe(key2);
    });
  });
});
```

---

## 8. Integration Tests for `packages/services`

Integration tests hit a real database. They're slower than unit tests but test the most important behaviors: does your data actually get stored and retrieved correctly?

### Setup: Global Test Infrastructure

```typescript
// packages/services/src/__tests__/globalSetup.ts
// This file runs ONCE before all test files

import { execSync } from 'child_process';

export async function setup() {
  console.log('\n🔧 Setting up test database...');

  // Use a separate database for tests to avoid corrupting development data
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    ?? 'postgresql://postgres:postgres@localhost:5432/oneglanse_test';
  process.env.CLICKHOUSE_URL = process.env.TEST_CLICKHOUSE_URL
    ?? 'http://localhost:8123';

  // Run migrations against the test database
  // This ensures the test database schema matches the current codebase
  execSync('pnpm --filter @oneglanse/db db:migrate', {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
    stdio: 'inherit',
  });

  console.log('✅ Test database ready.\n');
}

export async function teardown() {
  // Optional: drop the test schema after all tests complete
  // Useful in CI to ensure a clean state for the next run
  console.log('🧹 Cleaning up test database...');
}
```

```typescript
// packages/services/src/__tests__/testSetup.ts
// This file runs before EACH TEST FILE (not each test)

import { db } from '@oneglanse/db';
import { workspaces, workspaceMembers } from '@oneglanse/db/schema';

// Clear database tables between test files to prevent test pollution
// (tests writing data that affects other tests)
beforeAll(async () => {
  // Delete in dependency order (members before workspaces, etc.)
  await db.delete(workspaceMembers);
  await db.delete(workspaces);
  // Add other tables as needed
});
```

### Helper: `createTestUser` and `createTestWorkspace`

Repeating the "create a user, create an org, create a workspace" sequence in every test is tedious and makes tests hard to read. Extract it into test helpers:

```typescript
// packages/services/src/__tests__/helpers.ts

import { db } from '@oneglanse/db';
import { randomUUID } from 'crypto';

export async function createTestUser(overrides: Partial<{ email: string; name: string }> = {}) {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: overrides.email ?? `test-${id}@example.com`,
    name: overrides.name ?? 'Test User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function createTestOrganization(ownerId: string) {
  const id = randomUUID();
  await db.insert(organizations).values({
    id,
    name: 'Test Organization',
    slug: `test-org-${id}`,
    createdAt: new Date(),
  });
  await db.insert(members).values({ userId: ownerId, organizationId: id, role: 'owner' });
  return id;
}

export async function createTestWorkspace(orgId: string, overrides: Partial<typeof workspaces.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(workspaces).values({
    id,
    name: 'Test Workspace',
    slug: `test-workspace-${id}`,
    tenantId: orgId,
    country: 'US',
    region: null,
    enabledProviders: JSON.stringify(['openai', 'anthropic']),
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}
```

### Workspace Service Tests

```typescript
// packages/services/src/__tests__/workspace.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createWorkspaceForTenant,
  getWorkspaceById,
  addMemberToWorkspace,
  removeMemberFromWorkspace,
  getWorkspaceMembersWithUsers,
} from '../workspace';
import { createTestUser, createTestOrganization } from './helpers';

describe('Workspace service (integration)', () => {
  let testUserId: string;
  let testOrgId: string;

  // Run before EACH test in this describe block
  // Using beforeEach ensures tests don't affect each other
  beforeEach(async () => {
    testUserId = await createTestUser();
    testOrgId = await createTestOrganization(testUserId);
  });

  describe('createWorkspaceForTenant', () => {
    it('creates a workspace with the correct name and slug', async () => {
      const workspace = await createWorkspaceForTenant({
        name: 'My Brand',
        tenantId: testOrgId,
        country: 'US',
        region: null,
      });

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('My Brand');
      // Slug should be auto-generated from name:
      expect(workspace.slug).toBe('my-brand');
    });

    it('auto-generates a unique slug if the name conflicts', async () => {
      await createWorkspaceForTenant({ name: 'Brand', tenantId: testOrgId, country: 'US', region: null });
      const second = await createWorkspaceForTenant({ name: 'Brand', tenantId: testOrgId, country: 'US', region: null });

      // Second workspace with same name should get a suffix to avoid slug collision:
      expect(second.slug).not.toBe('brand');
      expect(second.slug).toMatch(/^brand-\w+$/);
    });

    it('stores the correct country and region', async () => {
      const workspace = await createWorkspaceForTenant({
        name: 'EU Brand',
        tenantId: testOrgId,
        country: 'DE',
        region: 'Bavaria',
      });

      const fetched = await getWorkspaceById(workspace.id);
      expect(fetched?.country).toBe('DE');
      expect(fetched?.region).toBe('Bavaria');
    });
  });

  describe('member management', () => {
    it('adds a member to a workspace', async () => {
      const workspaceId = (await createWorkspaceForTenant({
        name: 'Team WS', tenantId: testOrgId, country: 'US', region: null
      })).id;
      const memberId = await createTestUser({ email: 'member@test.com' });

      await addMemberToWorkspace({ workspaceId, userId: memberId });

      const members = await getWorkspaceMembersWithUsers(workspaceId);
      expect(members.some(m => m.userId === memberId)).toBe(true);
    });

    it('does not add the same member twice', async () => {
      const workspaceId = (await createWorkspaceForTenant({
        name: 'Team WS', tenantId: testOrgId, country: 'US', region: null
      })).id;
      const memberId = await createTestUser({ email: 'member@test.com' });

      await addMemberToWorkspace({ workspaceId, userId: memberId });
      await addMemberToWorkspace({ workspaceId, userId: memberId }); // Second add

      const members = await getWorkspaceMembersWithUsers(workspaceId);
      const memberCount = members.filter(m => m.userId === memberId).length;
      expect(memberCount).toBe(1); // Should not have duplicates
    });

    it('removes a member from a workspace (soft delete)', async () => {
      const workspaceId = (await createWorkspaceForTenant({
        name: 'Team WS', tenantId: testOrgId, country: 'US', region: null
      })).id;
      const memberId = await createTestUser({ email: 'member@test.com' });

      await addMemberToWorkspace({ workspaceId, userId: memberId });
      await removeMemberFromWorkspace({ workspaceId, userId: memberId });

      const members = await getWorkspaceMembersWithUsers(workspaceId);
      expect(members.some(m => m.userId === memberId && !m.deletedAt)).toBe(false);
    });
  });
});
```

---

## 9. Integration Tests for tRPC Routers

tRPC routers have their own testing approach: you use `createCallerFactory` from `@trpc/server` to call procedures directly without an HTTP server. This is fast (no network overhead) but tests the full procedure including middleware.

```typescript
// apps/web/src/__tests__/routers/workspace.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '../../server/api/root';
import { createTRPCContext } from '../../server/api/trpc';
import { createTestUser, createTestOrganization, createTestWorkspace } from '../helpers';

// The caller factory creates a type-safe caller from the router
const createCaller = createCallerFactory(appRouter);

// Helper to create an authenticated context
async function createAuthenticatedContext(userId: string) {
  // Mock the session that better-auth would normally provide
  return createTRPCContext({
    session: {
      user: { id: userId, email: `${userId}@test.com`, name: 'Test User' },
      session: { id: 'session-id', token: 'token', expiresAt: new Date(Date.now() + 3600_000) },
    },
    headers: new Headers(),
  });
}

describe('workspace router (integration)', () => {
  let userId: string;
  let orgId: string;

  beforeEach(async () => {
    userId = await createTestUser();
    orgId = await createTestOrganization(userId);
  });

  describe('create', () => {
    it('creates a workspace for an authenticated user', async () => {
      const ctx = await createAuthenticatedContext(userId);
      const caller = createCaller(ctx);

      const result = await caller.workspace.create({
        name: 'My Brand Workspace',
        country: 'US',
        region: null,
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('My Brand Workspace');
    });

    it('throws UNAUTHORIZED for unauthenticated requests', async () => {
      // Create context with no session
      const ctx = await createTRPCContext({
        session: null,
        headers: new Headers(),
      });
      const caller = createCaller(ctx);

      await expect(
        caller.workspace.create({ name: 'Test', country: 'US', region: null })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  describe('list', () => {
    it('returns only workspaces the user belongs to', async () => {
      const ctx = await createAuthenticatedContext(userId);
      const caller = createCaller(ctx);

      // Create workspace for this user:
      await caller.workspace.create({ name: 'User WS', country: 'US', region: null });

      // Create workspace for a DIFFERENT user (should NOT appear in list):
      const otherUserId = await createTestUser({ email: 'other@test.com' });
      await createTestWorkspace(orgId, { name: 'Other User WS' });

      const result = await caller.workspace.list();

      expect(result.some((ws: { name: string }) => ws.name === 'User WS')).toBe(true);
      expect(result.some((ws: { name: string }) => ws.name === 'Other User WS')).toBe(false);
    });
  });

  describe('internal router', () => {
    it('rejects requests without INTERNAL_CRON_SECRET', async () => {
      const ctx = await createTRPCContext({
        session: null,
        headers: new Headers({ 'x-internal-token': 'wrong-token' }),
      });
      const caller = createCaller(ctx);

      await expect(
        caller.internal.runScheduledAnalysis({ workspaceId: 'some-id' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });
});
```

---

## 10. E2E Tests with Playwright

E2E tests run a real browser against a real (or staging) server. They're the slowest tests but catch issues that unit and integration tests miss — things like CSS animations blocking clicks, JavaScript hydration timing issues, or auth redirect loops.

### Setup: `apps/web/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Where to find E2E test files:
  testDir: './src/__tests__/e2e',

  // Don't run tests in parallel in E2E (auth state can conflict):
  fullyParallel: false,

  // Fail the entire test run if any test has .only (prevents accidental CI skips):
  forbidOnly: !!process.env.CI,

  // Retry failed tests in CI (network flakiness, timing issues):
  retries: process.env.CI ? 2 : 0,

  // Single worker for auth-dependent tests:
  workers: 1,

  // Generate HTML report for debugging:
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['github'],   // GitHub Actions annotations
  ],

  use: {
    // Base URL for all page.goto() calls:
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    // Take trace on first retry (for debugging CI failures):
    trace: 'on-first-retry',

    // Screenshot only on failure:
    screenshot: 'only-on-failure',

    // Videos only on failure:
    video: 'on-first-retry',
  },

  projects: [
    // Desktop Chrome is the primary test target:
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Optional: also test on Firefox:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],

  // Start the Next.js dev server before running tests:
  webServer: {
    command: 'pnpm --filter @oneglanse/web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,  // In CI, always start fresh
    timeout: 120_000,                       // 2 minutes to start Next.js
  },
});
```

### Critical E2E Flows

```typescript
// apps/web/src/__tests__/e2e/auth.spec.ts

import { test, expect, type Page } from '@playwright/test';

// Shared helper: create an authenticated browser state
// Reuse this across tests to avoid logging in before every test
export async function loginAs(page: Page, email: string, password: string = 'TestPassword123!') {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('[type="submit"]');
  // Wait for redirect to dashboard (confirms login succeeded):
  await page.waitForURL('/dashboard', { timeout: 10_000 });
}

test.describe('Authentication flows', () => {

  test('redirects unauthenticated user from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login:
    await expect(page).toHaveURL(/\/login/);
  });

  test('user can log in with valid credentials', async ({ page }) => {
    // Note: this test requires a seeded test user in the database
    await loginAs(page, 'e2e-test@example.com');
    await expect(page.locator('h1, [data-testid="dashboard-title"]')).toBeVisible();
  });

  test('login shows error with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'e2e-test@example.com');
    await page.fill('[name="password"]', 'wrong-password');
    await page.click('[type="submit"]');
    // Should NOT redirect — should show error:
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[role="alert"], .error-message')).toBeVisible();
  });

  test('user can log out', async ({ page }) => {
    await loginAs(page, 'e2e-test@example.com');
    await page.click('[data-testid="logout-button"], button:has-text("Log out")');
    await expect(page).toHaveURL(/\/(login|$)/);
  });
});
```

```typescript
// apps/web/src/__tests__/e2e/workspace.spec.ts

import { test, expect } from '@playwright/test';
import { loginAs } from './auth.spec';

test.describe('Workspace management', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'e2e-test@example.com');
  });

  test('user can create a new workspace', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="create-workspace-button"], button:has-text("Create workspace")');

    // Fill workspace creation form:
    await page.fill('[name="name"]', 'E2E Test Workspace');
    await page.selectOption('[name="country"]', 'US');
    await page.click('[type="submit"]');

    // Wait for workspace to appear:
    await expect(page.locator('h1, [data-testid="workspace-name"]')).toContainText('E2E Test Workspace');
  });

  test('workspace appears in the sidebar after creation', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="create-workspace-button"]');
    await page.fill('[name="name"]', 'Sidebar Test WS');
    await page.click('[type="submit"]');

    // Check sidebar:
    await expect(page.locator('[data-testid="sidebar"], nav')).toContainText('Sidebar Test WS');
  });
});
```

---

## 11. Test Data Management & Fixtures

### The Problem with Shared Test Data
If test A creates a workspace and test B reads all workspaces, test B's assertions break when test A's data appears unexpectedly. Each test should create its own data and clean it up after.

### Pattern 1: `beforeEach` / `afterEach` Cleanup

```typescript
describe('workspace tests', () => {
  let workspaceId: string;

  beforeEach(async () => {
    workspaceId = await createTestWorkspace(...);
  });

  afterEach(async () => {
    // Clean up even if the test fails
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  });
});
```

### Pattern 2: Unique Namespacing

Add a unique prefix to all test data to prevent conflicts when multiple test runs overlap:

```typescript
const TEST_RUN_ID = randomUUID().slice(0, 8); // e.g., "ab12cd34"

const testEmail = `test-${TEST_RUN_ID}@example.com`;
const testWorkspaceName = `Test WS ${TEST_RUN_ID}`;
// This means even if two CI runs happen simultaneously, their data doesn't conflict
```

---

## 12. Mocking Strategies

### Mocking the Browser (for agent unit tests)

You cannot (and should not) launch a real browser in unit tests. Mock the Playwright `Page` object:

```typescript
import { vi } from 'vitest';
import type { Page, ElementHandle } from 'playwright';

// Create a minimal mock that satisfies the Page interface
// Only mock the methods your function actually calls
export function createMockPage(overrides: Partial<Page> = {}): Page {
  return {
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    evaluate: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://chatgpt.com/'),
    ...overrides,
  } as unknown as Page;
}

// Usage in a test:
it('falls back to force-click when Enter key fails', async () => {
  const mockPage = createMockPage({
    // Simulate Enter key failing (no submission indicators appear)
    evaluate: vi.fn().mockResolvedValue(false),
    // But the force-click button exists and is clickable:
    $: vi.fn().mockResolvedValue({ click: vi.fn() } as unknown as ElementHandle),
  });

  const result = await askPrompt(mockPage, 'test prompt', 'openai');
  expect(result.submitted).toBe(true);
});
```

### Mocking External APIs (for services tests)

```typescript
import { vi } from 'vitest';

// Mock OpenAI client so tests don't make real API calls:
vi.mock('@oneglanse/services/llm', () => ({
  getLLMClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                geoScore: 75,
                presence: { visibility: 80, prominenceScore: 70 },
                sentiment: { score: 65, label: 'positive' },
                // ... rest of BrandAnalysisResult
              })
            }
          }]
        })
      }
    }
  })
}));
```

### Mocking Redis (for unit tests that touch job queues)

```typescript
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    quit: vi.fn().mockResolvedValue('OK'),
  };
  return { default: vi.fn(() => mockRedis), Redis: vi.fn(() => mockRedis) };
});
```

---

## 13. CI Integration

Add a complete test job to `.github/workflows/docker-build.yml`:

```yaml
# Add this job to .github/workflows/docker-build.yml

test:
  name: Test Suite
  runs-on: ubuntu-latest

  # Spin up test services using GitHub Actions service containers
  # These run as Docker containers alongside the test runner
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: oneglanse_test
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

    redis:
      image: redis:7-alpine
      ports:
        - 6379:6379
      options: >-
        --health-cmd "redis-cli ping"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

    # Note: ClickHouse is NOT included because GitHub Actions service containers
    # don't support ClickHouse well. Use a mocked ClickHouse client in tests,
    # or run ClickHouse integration tests in a separate job with a custom Docker setup.

  env:
    TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/oneglanse_test
    REDIS_URL: redis://localhost:6379
    # Dummy values for required env vars (tests use mocked clients):
    OPENAI_API_KEY: sk-test
    BETTER_AUTH_SECRET: test-secret-at-least-32-characters-long
    INTERNAL_CRON_SECRET: test-cron-secret-at-least-32-chars-long

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

    - name: Build shared packages (required for tests that import from them)
      run: pnpm turbo build --filter='./packages/*'

    - name: Run unit tests
      run: pnpm turbo test --filter='./packages/*'

    - name: Run typecheck
      run: pnpm typecheck

    - name: Upload coverage reports
      uses: codecov/codecov-action@v4
      with:
        files: packages/*/coverage/lcov.info
        fail_ci_if_error: false  # Don't fail CI for coverage upload issues

# Make build jobs depend on test passing:
build-web:
  needs: [changes, test]
  ...

build-agent:
  needs: [changes, test]
  ...
```

---

## 14. Coverage Requirements

Set these as enforced thresholds in `vitest.config.ts` for each package:

| Package | Lines | Functions | Branches | Rationale |
|---------|-------|-----------|----------|-----------|
| `packages/utils` | 90% | 90% | 85% | Pure functions — no excuse for low coverage |
| `packages/errors` | 90% | 90% | 85% | Small, critical, easy to test |
| `packages/types` | N/A | N/A | N/A | Type definitions only — nothing to test |
| `packages/services` | 70% | 70% | 65% | Database-dependent — some paths need real DB |
| `apps/agent/src/lib/` | 60% | 60% | 55% | Browser mocking is complex — pragmatic target |
| `apps/web/src/server/` | 60% | 60% | 55% | tRPC caller tests cover the important paths |

### Adding Coverage Thresholds to Vitest

```typescript
// packages/utils/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        // If coverage drops below threshold, vitest exits with error code 1
        // This fails the CI job
      },
    },
  },
});
```

---

## 15. Test Naming Conventions

Good test names make failures self-explanatory. Follow this pattern:

**Format:** `[function/feature] [condition] [expected outcome]`

```typescript
// ✅ Good names — tell you exactly what failed and why:
it('getDomain returns null for invalid URLs')
it('workspace.create throws UNAUTHORIZED when user is not logged in')
it('proxyPool penalizes bot_detection failures with exponential backoff')
it('safeHandler maps AuthError to HTTP 401 response')
it('extractSources deduplicates URLs with #:~:text= fragments')

// ❌ Bad names — tell you nothing about the failure:
it('works correctly')
it('handles the error')
it('test 1')
it('getDomain test')
it('edge case')
```

**Use `describe` blocks to group by feature, then by scenario:**

```typescript
describe('ProxyPool', () => {                 // Feature
  describe('failure recording', () => {       // Scenario group
    it('reduces score after bot_detection')   // Specific behavior
    it('applies exponential backoff')         // Another behavior
    it('resets cooldown on success')          // Related behavior
  });
  describe('proxy selection', () => {
    it('selects highest-scored non-cooldown proxy')
    it('returns null when all proxies in cooldown')
  });
});
```

This hierarchical structure means test output reads like a specification document, and failures point you exactly to the component and scenario that broke.
