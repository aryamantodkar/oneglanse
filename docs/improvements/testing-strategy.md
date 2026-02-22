# Testing Strategy Audit

## Current State
- Test coverage is effectively zero across apps and packages.
- `turbo.json` defines a `test` task, but no workspace has a real test script or test files.
- This is release-blocking for production and OSS credibility.

## Standardize on One Stack
- Unit/integration runner: `vitest`.
- E2E runner: `@playwright/test`.
- API integration: `supertest` for HTTP endpoints and direct tRPC caller tests.
- Mocking: `vi.mock` + local test doubles (avoid global monkey-patching).
- Coverage: V8 provider with per-workspace thresholds.

## Recommended Test Folder Structure
- `apps/web/src/__tests__/unit/*`
- `apps/web/src/__tests__/integration/*`
- `apps/web/e2e/*`
- `apps/agent/src/__tests__/unit/*`
- `apps/agent/src/__tests__/integration/*`
- `packages/db/src/__tests__/*`
- `packages/errors/src/__tests__/*`
- `packages/services/src/__tests__/*`
- `packages/types/src/__tests__/*`
- `packages/ui/src/__tests__/*`
- `packages/utils/src/__tests__/*`

## Missing Unit Tests by Module
- `apps/web/src/lib/workspace/joinCode.ts`
  - Cases: malformed separators, whitespace-only, mixed delimiter inputs.
- `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts`
  - Cases: partial/null brand analysis, empty datasets, provider filter edge cases.
- `apps/web/src/server/api/routers/workspace/workspace.ts`
  - Cases: join-code branch behavior, owner/member permission checks.
- `apps/agent/src/lib/browser/proxy/pool.ts`
  - Cases: cooldown behavior, exploration rate selection, scoring tie-breaks.
- `apps/agent/src/lib/browser/proxy/snapshot.ts`
  - Cases: manual mode empty file, API fallback behavior, cache TTL behavior.
- `apps/agent/src/lib/browser/healthCheck.ts`
  - Cases: bot-detection patterns, login detection false positives, rate-limit detection.
- `packages/services/src/prompt/index.ts`
  - Cases: dedupe prompt insert/delete, query parameter correctness, cron schedule payload.
- `packages/services/src/analysis/analysis.ts`
  - Cases: analysis JSON parsing failures, metadata injection, partial failure behavior.
- `packages/errors/src/errorHandling.ts`
  - Cases: BaseError mapping, external HTTP error mapping, unknown error fallback.
- `packages/utils/src/analysis/filterAnalysisRecords.ts`
  - Cases: date edge boundaries, all model filter, promptId filter precedence.

## Missing Integration Tests
- Web tRPC routers:
  - `apps/web/src/server/api/routers/agent/agent.ts`
  - `apps/web/src/server/api/routers/internal/internal.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.ts`
  - Must test authz failure, workspace membership checks, and queue bootstrap outputs.
- Agent API:
  - `apps/agent/src/api.ts`
  - Must test unauthorized upload, oversized payload, invalid JSON, valid upload path.
- Services + storage:
  - `packages/services/src/prompt/index.ts`
  - `packages/services/src/analysis/analysis.ts`
  - Must test ClickHouse and Redis interactions in containerized test environment.
- Cross-package contracts:
  - `@onescope/types` contracts consumed by web and agent should have contract tests to prevent shape drift.

## Missing E2E Tests
- Web critical flows:
  - login/signup/logout
  - create workspace
  - add prompt
  - run prompt job
  - monitor job completion
  - view dashboard/sources/prompts pages
- Agent critical flows:
  - auth upload and health endpoint
  - job ingestion and provider run path
  - proxy exhaustion/fallback path
- Failure-path E2E:
  - expired auth session
  - internal secret mismatch
  - Redis unavailable
  - ClickHouse unavailable

## Mocking Strategy
- Unit tests:
  - mock network/provider APIs only.
  - do not mock pure utility functions under test.
- Integration tests:
  - use real Redis + Postgres + ClickHouse in Docker test profile.
  - use deterministic fixtures and cleanup transaction-per-test or table truncation.
- E2E tests:
  - mock third-party LLM UIs where possible; run limited real-browser smoke nightly only.

## CI Test Enforcement Strategy
- Add jobs in `.github/workflows/docker-build.yml` or split into dedicated workflows:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage` on main branch/nightly
- Gate PR merge on passing tests.
- Set minimum coverage thresholds:
  - packages: 80% lines/functions
  - apps critical modules: 70% initial threshold, ratchet upward.

## 1–2 Day Implementation Plan
- Day 1:
  - wire Vitest configs/workspace scripts.
  - add unit tests for `packages/utils`, `packages/errors`, proxy modules.
- Day 2:
  - add integration tests for `agent.ts` and key workspace router flows.
  - add one e2e smoke test for login -> workspace -> run prompts.

## 🔥 Critical — Must Fix Before Open Source
- Add baseline unit tests for utilities/services and router authz behavior.
- Add integration tests for agent API upload and queue bootstrap.
- Enforce `pnpm test` in CI.

## ⚡ High Priority — Fix This Week
- Add end-to-end smoke tests for core user and agent workflows.
- Add coverage thresholds and PR gating.
- Add contract tests for shared types consumed by web and agent.

## 🟡 Medium Priority — Improve Soon
- Add fault-injection integration tests (Redis/ClickHouse failure).
- Add retry policy tests for agent run loop and proxy rotation.

## 💤 Later Improvements
- Add performance regression tests for large prompt sets.
- Add browser compatibility matrix for UI E2E.
