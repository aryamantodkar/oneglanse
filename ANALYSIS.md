# OneScope AI — Full Codebase Analysis

> Generated: 2026-02-19
> Scope: `apps/agent`, `apps/web`, all `packages/`, infrastructure, CI/CD
> Agents deployed: 3 parallel exploration agents (agent app, web+packages, infrastructure)
> **No code was changed. This document is for review only.**

---

## Quick Navigation

- [Priority Matrix](#priority-matrix)
- [CRITICAL Issues (5)](#critical-issues)
- [HIGH Issues (8)](#high-issues)
- [MEDIUM Issues (12)](#medium-issues)
- [LOW Issues (6)](#low-issues)
- [Detailed Reports](#detailed-reports)

---

## Priority Matrix

| Priority | Count | Threshold |
|----------|-------|-----------|
| 🔴 CRITICAL | 5 | Fix before next deploy |
| 🟠 HIGH | 8 | Fix this sprint |
| 🟡 MEDIUM | 12 | Fix this quarter |
| 🟢 LOW | 6 | Technical debt backlog |

---

## CRITICAL Issues

These issues represent security vulnerabilities, data corruption risks, or runtime failures that can happen in production right now.

### C1 — ClickHouse Pagination Infinite Loop
**File:** `packages/services/src/analysis/analysis.ts:59`
**Area:** Web/Services

The ClickHouse analysis query uses a `WHILE` loop with a `LIMIT` but **no `OFFSET`**. Every iteration fetches the same first batch of rows. If `analyzeAll: true` is passed (which happens after every prompt run), the loop runs forever on the same data, burning OpenAI API credits on redundant LLM calls and potentially never terminating.

```
SELECT * FROM analytics.prompt_responses WHERE ... LIMIT {batchSize}
                                                   ^^^^^ NO OFFSET
```

**Fix:** Add `OFFSET (batchNumber * batchSize)` or use cursor-based pagination with `AND id > lastSeenId ORDER BY id`.
See: `apps/web/ANALYSIS.md` → Issue W3

---

### C2 — Internal Route Auth Bypass
**File:** `apps/web/src/server/api/middleware/isInternal.ts:9`
**Area:** Web

Two compounding vulnerabilities:

1. **Undefined secret**: If `INTERNAL_CRON_SECRET` is not set in `.env`, `process.env.INTERNAL_CRON_SECRET` is `undefined`. Any request with `Authorization: Bearer undefined` passes the check.
2. **Timing attack**: Plain `!==` string comparison is not constant-time. An attacker can enumerate the secret one character at a time via response timing.

**Fix:** Assert `INTERNAL_CRON_SECRET` exists on startup. Use `crypto.timingSafeEqual()` for comparison.
See: `apps/web/ANALYSIS.md` → Issue W1

---

### C3 — Regex Double-Escape Bug in AI Overview Extraction
**File:** `apps/agent/src/agents/ai-overview/lib/extractResponse.ts:10-17`
**Area:** Agent

The `SOURCE_CARD_DATE_PATTERN` regex is constructed from string literals with `\\\\d` which evaluates to `\\d` (a literal backslash + `d`), not `\d` (the digit character class). The pattern **never matches any date**, so source card noise is never stripped from the extracted AI Overview response.

```typescript
// Current (broken) — \\\\d in string literal → \\d in regex → never matches
'[A-Z][a-z]+ \\\\d{1,2}, \\\\d{4}'

// Should be
String.raw`[A-Z][a-z]+ \d{1,2}, \d{4}`
```

**Fix:** Use `String.raw` template literal or regex literal `/pattern/`.
See: `apps/agent/ANALYSIS.md` → Bug #2

---

### C4 — Path Traversal on Auth File Write
**File:** `apps/agent/src/api.ts:54`
**Area:** Agent API

The session upload endpoint writes auth JSON files to `path.join(VPS_AUTH_PROFILE_PATH, provider, ...)`. `VPS_AUTH_PROFILE_PATH` is taken from an env var but **never validated to be within an expected base directory**. An attacker who can reach the API can craft a request to write to arbitrary filesystem paths.

**Fix:** Resolve both the target path and the base path, then assert the target starts with the base (`resolvedPath.startsWith(resolvedBase)`).
See: `apps/agent/ANALYSIS.md` → Security #3

---

### C5 — Exposed Database Ports
**File:** `docker-compose.yml:59, 78-80`
**Area:** Infrastructure

PostgreSQL (5432), ClickHouse HTTP (8123), and ClickHouse TCP (9000) are all bound to `0.0.0.0`, making them accessible from any network interface on the host — including public interfaces.

**Fix:** Change all to `127.0.0.1:PORT:PORT`.
See: `INFRASTRUCTURE.md` → Issue I1

---

## HIGH Issues

### H1 — Missing Role Check on `removeMember`
**File:** `apps/web/src/server/api/routers/workspace/workspace.ts:558`
**Area:** Web

Any authenticated workspace member can call `removeMember` to remove any other member, including the owner. There is no role check.

**Fix:** Check `ctx.membership.role === "owner"` before executing removal.

---

### H2 — Unsafe JSON.parse Without Schema Validation
**Files:**
- `apps/web/src/server/api/routers/agent/agent.ts:29`
- `apps/web/src/server/api/routers/workspace/workspace.ts:588, 607, 652`
**Area:** Web

`JSON.parse(enabledProviders)` and similar calls are made without validating the resulting value against a schema. If the database value is corrupted or tampered with, the raw result is used as `Provider[]` without type verification.

**Fix:** Wrap with Zod: `ProvidersSchema.parse(JSON.parse(raw))`.

---

### H3 — Token Timing Attack in Agent API
**File:** `apps/agent/src/api.ts:15`
**Area:** Agent API

```typescript
if (!API_AUTH_TOKEN || token !== API_AUTH_TOKEN)
```

Plain string comparison is vulnerable to timing side-channels.

**Fix:** Use `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(API_AUTH_TOKEN))`.

---

### H4 — Debug Screenshots Contain Sensitive Auth Data
**File:** `apps/agent/src/agents/google/auth/validateAuth.ts:61-76`
**Area:** Agent

Full-page screenshots are saved to `/storage/debug-screenshots` when Google auth fails. These screenshots can contain session cookies, localStorage tokens, and page content visible in the browser.

**Fix:** Disable full-page screenshots in production. If screenshots are needed for debugging, crop to a safe region and exclude auth-sensitive areas.

---

### H5 — Browser Cleanup Silently Swallows Errors
**File:** `apps/agent/src/agents/lib/agentHandler.ts:152-154`
**Area:** Agent

```typescript
await refs.context?.close().catch(() => {});
await refs.browser?.close().catch(() => {});
```

Errors during browser close are silently discarded. If Playwright fails to close a browser, the process leaks memory and Chromium instances accumulate.

**Fix:** Log close errors. Add a 10-second timeout with `Promise.race` and force-kill if exceeded.

---

### H6 — Graceful Shutdown Does Nothing
**File:** `apps/agent/src/index.ts:4-12`
**Area:** Agent

The `shutdown` function registered for `SIGTERM`/`SIGINT` has an **empty `try` block** — no Redis disconnect, no BullMQ drain, no browser cleanup.

**Fix:** Implement actual cleanup: call `worker.close()`, `redis.quit()`, and close any open browser instances.

---

### H7 — Non-null Assertions on Unvalidated Data
**File:** `apps/web/src/server/api/routers/prompt/prompt.ts:25, 38, 52`
**Area:** Web

```typescript
prompts: prompts!,
workspaceId: workspaceId!,
userId: userId!
```

These bypass TypeScript's type system. If any value is `undefined`, the error surface moves from compile-time to a runtime crash with no context.

**Fix:** Replace with explicit guards: `if (!prompts) throw new TRPCError(...)`.

---

### H8 — No Tests or Type Checks in CI Before Docker Build
**File:** `.github/workflows/docker-build.yml`
**Area:** Infrastructure

The GitHub Actions pipeline builds and pushes Docker images without running `pnpm typecheck`, `pnpm lint`, or any test suite first. TypeScript errors can reach production containers.

**Fix:** Add `pnpm typecheck && pnpm lint` step before the Docker build steps.

---

## MEDIUM Issues

### M1 — Proxy Credentials Logged in Plaintext
**File:** `apps/agent/src/lib/browser/launchContext.ts:42`
If proxy URLs contain credentials (`http://user:pass@host:port`), they're logged unredacted.

**Fix:** `proxy.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')` before logging.

---

### M2 — Duplicate Source Extraction Logic (5 copies)
**Files:** `apps/agent/src/agents/*/lib/extractSources.ts` (5 files)
URL normalization, domain extraction, favicon generation, and `seen` deduplication are copy-pasted across all 5 provider implementations with slight variations. ~40% of code is shared logic with no shared utility.

**Fix:** Create `apps/agent/src/lib/extraction/sourceUtils.ts` with shared helpers.

---

### M3 — Two Separate `classifyError()` Functions
**Files:**
- `apps/agent/src/agents/lib/agentHandler.ts`
- `apps/agent/src/agents/lib/runPrompts.ts`

Both classify errors into `FailureType`, but with different regex patterns. The proxy scoring system gets inconsistent inputs.

**Fix:** Merge into one canonical function in a shared utility file.

---

### M4 — Redis Has No Authentication
**File:** `docker-compose.yml`
Redis is deployed with no password. Any container on the Docker network can access the job queue.

**Fix:** Add `command: redis-server --requirepass ${REDIS_PASSWORD}` and update all connection configs.

---

### M5 — Service Dependencies Use `service_started` Not `service_healthy`
**File:** `docker-compose.yml`
The `web` service depends on `redis` and `clickhouse` with `condition: service_started` — meaning web starts as soon as those containers exist, not when they're actually ready to accept connections.

**Fix:** Add health checks to Redis and ClickHouse, then use `condition: service_healthy`.

---

### M6 — Missing Health Checks on 4 Services
**File:** `docker-compose.yml`
`agent-api`, `agent-worker`, `redis`, and `clickhouse` have no `healthcheck` defined. Docker considers them healthy the moment they start.

---

### M7 — Manual Cron Expression Parsing
**File:** `apps/web/src/server/api/routers/workspace/workspace.ts:706-756`
Cron expressions are parsed manually with `split(' ')` and `parseInt()` with no bounds checking on hour/minute values.

**Fix:** Use the `cron-parser` npm package for validation and parsing.

---

### M8 — Infinite Page Timeouts
**File:** `apps/agent/src/lib/browser/setupPage.ts:11-12`
```typescript
page.setDefaultTimeout(0);
page.setDefaultNavigationTimeout(0);
```
Setting these to 0 means no timeout. A hung page will deadlock the worker forever.

**Fix:** Set reasonable values: `60_000` (60 seconds) for both.

---

### M9 — Redis Connection Never Closed
**File:** `apps/agent/src/worker.ts`, `apps/agent/src/index.ts`
The Redis client is connected at startup but `redis.quit()` is never called on shutdown. Combined with the empty shutdown handler (H6), this causes connection leaks.

---

### M10 — TypeScript Version Mismatch Across Packages
**Files:** Various `package.json` files
`apps/agent` uses TypeScript `^5.9.3` while `apps/web` and all packages use `^5.8.2`. Mixed TypeScript versions in a monorepo can produce subtle compatibility issues with declaration files.

**Fix:** Pin one version (e.g., `5.9.3`) across the entire monorepo.

---

### M11 — Missing Database Indexes
**File:** `packages/db/src/schema/`
Missing composite indexes on:
- `user_prompts(workspace_id, is_analysed)` — used in analysis batch queries
- `prompt_responses(workspace_id, is_analysed)` — same
- `account(refresh_token_expires_at)` — for cleanup/expiry queries

---

### M12 — PostgreSQL `http` and `pg_cron` Extensions Granted to PUBLIC
**File:** `packages/db/init-scripts/00-init.sql`
```sql
GRANT USAGE ON SCHEMA cron TO PUBLIC;
```
`pg_cron` can execute arbitrary SQL on a schedule. `http` allows outbound HTTP requests from inside PostgreSQL. Granting these to PUBLIC is overly permissive.

**Fix:** Grant only to the specific application role.

---

## LOW Issues

### L1 — No `.env.example` Files
No template showing required environment variables exists in any app or package directory. New developers have no reference for what to configure.

---

### L2 — Function Name Typos
**Files:**
- `apps/agent/src/agents/openai/lib/extractSources.ts:4` — `exractSoucesFromOpenai`
- `apps/agent/src/agents/perplexity/lib/extractSources.ts:4` — `exractSoucesFromPerplexity`

Inconsistent with `extractSourcesFromAnthropic`.

---

### L3 — Proxy Pool Never Cleaned Up
**File:** `apps/agent/src/lib/browser/proxyPool.ts`
The `proxyRecords` Map grows unbounded. With large proxy pools, stale records accumulate indefinitely in memory.

---

### L4 — `pnpm deploy --legacy` Flag
**File:** `Dockerfile.agent:21`
The `--legacy` flag suggests package compatibility issues that were worked around rather than resolved.

---

### L5 — No Linting for Agent or Packages
The web app uses Biome for linting. The agent app and all packages have no linter configured. Code quality issues go unchecked in most of the codebase.

---

### L6 — Inconsistent Timestamp Defaults in Schema
Some tables use `timestamp("created_at").defaultNow()`, others use `timestamp("created_at").notNull()` without a default — meaning callers must supply the timestamp, creating risk of client-supplied values.

---

## Detailed Reports

For deep-dive analysis with code snippets and specific fix guidance:

- **Agent App:** [`apps/agent/ANALYSIS.md`](apps/agent/ANALYSIS.md)
- **Web App + Packages:** [`apps/web/ANALYSIS.md`](apps/web/ANALYSIS.md)
- **Infrastructure:** [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md)
