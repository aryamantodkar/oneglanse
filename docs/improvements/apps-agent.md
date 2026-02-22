# apps/agent Audit

## 1. Structural Issues
- Incorrect architecture docs path in `apps/agent/readme.md` references `src/agents/lib/*` while code is in `src/agents/core/*`.
- Boundary workaround in build config:
  - `apps/agent/tsconfig.json` includes package source files directly.
- Runtime and auth concerns are mixed in top-level files.
- Concrete moves:
  - Move API server concerns from `apps/agent/src/api.ts` into:
    - `apps/agent/src/api/server.ts`
    - `apps/agent/src/api/routes/uploadSessions.ts`
    - `apps/agent/src/api/routes/health.ts`
  - Move worker bootstrapping from `apps/agent/src/worker.ts` into:
    - `apps/agent/src/worker/startWorker.ts`
    - `apps/agent/src/worker/events.ts`
  - Move retry/timeouts policy constants from distributed files to:
    - `apps/agent/src/config/runtimePolicy.ts`
- Remove dead/unused dependency-driven structure:
  - `express` is declared but not used.
  - `tar` is declared but not used.

## 2. Architectural Problems
- Layer boundaries are blurry:
  - auth/session transport, browser automation, queue handling, and analysis trigger logic are tightly coupled.
- Hidden error behavior:
  - `apps/agent/src/lib/utils/runStep.ts` swallows errors instead of propagating them.
- Resilience policy is not centralized:
  - retries/timeouts live in multiple modules with ad-hoc constants.
- Scalability risk:
  - background analysis is triggered per-provider completion in `apps/agent/src/worker/analysis.ts`, causing redundant concurrent analysis runs for the same workspace.
- Corrected structure:
  - `core/orchestration` (job lifecycle)
  - `infrastructure/browser` (Playwright/proxy)
  - `infrastructure/queue` (BullMQ/Redis)
  - `infrastructure/api` (HTTP endpoints)
  - `domain/analysis` (single-trigger analysis scheduling)

## 3. Code Quality Audit
- `apps/agent/src/lib/utils/runStep.ts`
  - Problem: catches errors and does not rethrow.
  - Exact change: rethrow after diagnostics capture.
  - Why it matters: failures become false-success paths and contaminate downstream behavior.
- `apps/agent/src/agents/core/createAgent.ts`
  - Problem: disables Playwright default timeouts (`setDefaultTimeout(0)`, `setDefaultNavigationTimeout(0)`).
  - Exact change: restore finite defaults and configure via env.
  - Why it matters: hung browser operations can block workers indefinitely.
- `apps/agent/src/worker/jobHandler.ts`
  - Problem: Redis progress object uses naive read-modify-write, race-prone under concurrency.
  - Exact change: atomic update pattern (Lua/CAS) or per-provider keys.
  - Why it matters: inconsistent job status reporting and lost progress updates.
- `apps/agent/src/worker/analysis.ts`
  - Problem: each provider completion triggers full workspace analysis.
  - Exact change: trigger analysis once per jobGroup when all providers complete.
  - Why it matters: redundant load, race conditions, possible duplicate work.
- `apps/agent/src/api.ts`
  - Problem: request body parsing uses manual event handling and no schema validation.
  - Exact change: validate payload with zod and explicit request timeout.
  - Why it matters: weak input safety and operational instability.
- Multiple files (`api.ts`, auth files, core agent files)
  - Problem: pervasive `catch (err: any)` and weak error typing.
  - Exact change: switch to `unknown` + typed error guards.
  - Why it matters: unpredictable error classification and fragile fallback logic.

## 4. Testing Requirements
### Missing Unit Tests
- `apps/agent/src/lib/browser/proxy/pool.ts`
- `apps/agent/src/lib/browser/proxy/snapshot.ts`
- `apps/agent/src/lib/browser/healthCheck.ts`
- `apps/agent/src/agents/core/runPrompts.ts`
- `apps/agent/src/lib/utils/runStep.ts`

### Missing Integration Tests
- `apps/agent/src/api.ts` upload/health route behavior.
- `apps/agent/src/worker/jobHandler.ts` queue execution and progress state updates.
- `apps/agent/src/agents/core/agentHandler.ts` cycle/attempt behavior with proxy failures.

### Missing E2E Tests
- auth login/upload flow end-to-end.
- queue ingestion -> prompt run -> response store.
- expired session behavior.
- proxy source fallback behavior (`PROXY_API_URL` down, manual fallback).

### Test Structure and CI
- Add:
  - `apps/agent/src/__tests__/unit/*`
  - `apps/agent/src/__tests__/integration/*`
- Enforce in CI with redis/clickhouse/postgres-backed integration profile.

## 5. Production Hardening
- Missing API rate limiting and request timeout controls.
- Logging is not structured and does not carry correlation IDs.
- `packages/services/src/agent/redis.ts` logs to console and hardcodes `port: 6379`.
- Graceful shutdown is present but lacks telemetry emission around drain duration and in-flight job IDs.
- Minimal viable fixes:
  - add limiter + timeout to upload endpoint.
  - use centralized logger with `{ jobGroupId, provider, workspaceId }` metadata.
  - remove hardcoded Redis port and respect env.
- Long-term fixes:
  - distributed tracing across API/worker/queue/analysis lifecycle.
  - single policy module for retries, timeouts, and circuit-break conditions.

## 6. Dependency Audit
- Remove unused from `apps/agent/package.json`:
  - `express`, `tar`, `ioredis`, `@types/express`.
- Re-evaluate test deps:
  - keep `@playwright/test` only after tests are added.
- Align versions with workspace:
  - `bullmq`, `ioredis`, `@types/node`.

## 7. OSS Readiness Audit
- `apps/agent/readme.md` has stale path references and overstates architecture clarity.
- Missing contributor guidance for adding providers safely.
- No documented test harness for browser automation failure simulation.

## 8. Required Rename/Move Commands
- Move:
  - `apps/agent/src/api.ts`
  - to `apps/agent/src/api/server.ts`
- Add:
  - `apps/agent/src/api/routes/uploadSessions.ts`
  - `apps/agent/src/api/routes/health.ts`
- Move:
  - `apps/agent/src/worker.ts`
  - to `apps/agent/src/worker/startWorker.ts`
- Move:
  - `apps/agent/src/lib/utils/runStep.ts`
  - to `apps/agent/src/agents/core/runStep.ts` and enforce throw-on-failure behavior.

## 🔥 Critical — Must Fix Before Open Source
- Stop swallowing step errors in `runStep.ts`.
- Restore finite browser/page timeouts.
- Add schema validation + rate limiting for `/upload-sessions`.
- Eliminate direct package source includes from `apps/agent/tsconfig.json`.
- Prevent duplicate concurrent workspace analysis triggers.

## ⚡ High Priority — Fix This Week
- Make progress updates concurrency-safe in Redis.
- Standardize structured logging and include identifiers.
- Remove unused dependencies and align shared versions.

## 🟡 Medium Priority — Improve Soon
- Refactor API and worker startup into smaller modules.
- Add integration tests for job lifecycle and proxy failure handling.
- Move retry/backoff constants into unified runtime policy module.

## 💤 Later Improvements
- Add provider-specific synthetic monitoring checks.
- Add performance/load testing for high-volume prompt batches.
