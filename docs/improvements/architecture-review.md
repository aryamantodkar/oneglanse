# Architecture Review

## Current Architecture Reality
- The repository structure looks modular, but dependency direction is violated in multiple places.
- Core issue: app code can and does reach into package internals, which makes the package layer cosmetic.
- Core issue: web API routers mix orchestration, access control, queueing, schedule parsing, and analytics mutation in single files.

## Clean Architecture Evaluation
- Not cleanly layered right now.
- Interface boundaries are mostly implicit and not enforced.
- Domain services are mixed with infra concerns:
  - `packages/services/src/prompt/index.ts` mixes business logic, SQL building, cron transport payload generation, and error logging fallback behavior.
  - `apps/web/src/server/api/routers/workspace/workspace.ts` mixes tenant/workspace/member/schedule/queue orchestration.
- Infrastructure leaks into app layer:
  - `apps/web/src/lib/auth/auth.ts` imports package DB internals directly.

## SOLID / DRY / KISS / YAGNI Findings
- Single Responsibility violated:
  - `apps/web/src/server/api/routers/workspace/workspace.ts` (875 lines, too many responsibilities).
  - `apps/web/src/app/(auth)/prompts/page.tsx` (1335 lines, UI + data transformation + rendering + export logic).
- DRY violated:
  - duplicate run-queue initialization in:
    - `apps/web/src/server/api/routers/agent/agent.ts`
    - `apps/web/src/server/api/routers/internal/internal.ts`
- Dependency Inversion violated:
  - app-level code depends on package source internals instead of package contracts.
- KISS violated:
  - custom cron next-run parsing in `workspace.ts` despite available parser libraries.

## Cohesion and Coupling Assessment
- `@onescope/services` is over-coupled to storage/queue/LLM providers in single modules.
- `@onescope/ui` leaks internal boundaries by self-importing package root in `sidebar.tsx`.
- `apps/web` has high coupling between UI pages and raw API response shapes (`any` casting everywhere).

## Concrete Redesign (1–2 Day Scope)

### 1. Split Web Workspace Router by Domain
- Move from:
  - `apps/web/src/server/api/routers/workspace/workspace.ts`
- To:
  - `apps/web/src/server/api/routers/workspace/workspace.core.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.members.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.schedule.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.join.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.router.ts`
- Result: explicit domain modules and smaller review surface.

### 2. Extract Shared Agent Run Orchestration
- Move duplicate queue bootstrap logic from:
  - `apps/web/src/server/api/routers/agent/agent.ts`
  - `apps/web/src/server/api/routers/internal/internal.ts`
- To:
  - `packages/services/src/agent/startPromptRun.ts`
- Result: one source of truth for job-group creation and Redis progress bootstrap.

### 3. Enforce Package Contracts
- Replace deep source import:
  - `apps/web/src/lib/auth/auth.ts`
- With:
  - exports from `packages/db/src/index.ts` and import through `@onescope/db`.
- Remove direct package source includes from:
  - `apps/agent/tsconfig.json`
- Result: true package boundaries and predictable build graph.

### 4. Isolate Scheduling and Cron Logic
- Move schedule-specific behavior from `workspace.ts` and `packages/services/src/prompt/index.ts` into:
  - `packages/services/src/scheduling/cronScheduler.ts`
  - `packages/services/src/scheduling/cronTiming.ts`
- Result: testable scheduling policy and no business logic inside route handlers.

### 5. Separate Read Models from UI Components
- Extract data transforms from giant pages into app-level query adapters:
  - `apps/web/src/app/(auth)/prompts/_lib/adapters/*.ts`
  - `apps/web/src/app/(auth)/people/_lib/adapters/*.ts`
- Result: page components become rendering-only and easier to test.

## Corrected Dependency Direction
- Target direction:
  - `apps/* -> packages/services|types|ui|utils`
  - `packages/services -> packages/db|errors|types|utils`
  - `packages/db -> packages/types`
  - `packages/ui -> packages/utils|types`
  - `packages/errors -> packages/types`
- Forbidden:
  - `apps/* -> packages/*/src/*`
  - `packages/ui -> @onescope/ui` (self-import)

## Structural Rename/Move Instructions
- Rename:
  - `apps/web/src/server/api/routers/workspace/workspace.ts`
  - to `apps/web/src/server/api/routers/workspace/workspace.router.ts`
- Move:
  - queue bootstrap code in `apps/web/src/server/api/routers/agent/agent.ts`
  - and `apps/web/src/server/api/routers/internal/internal.ts`
  - to `packages/services/src/agent/startPromptRun.ts`
- Move:
  - cron next-run logic from `apps/web/src/server/api/routers/workspace/workspace.ts`
  - to `packages/services/src/scheduling/cronTiming.ts`
- Move:
  - `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts`
  - to `packages/services/src/analysis/dashboardMetrics.ts` for shared analytics transformation.

## OSS Readiness Architecture Verdict
- Not OSS-grade yet because boundaries are not enforced and public contracts are ambiguous.
- External contributors will accidentally depend on internals unless contract boundaries are tightened first.

## 🔥 Critical — Must Fix Before Open Source
- Remove deep source imports and tsconfig cross-includes.
- Split `workspace.ts` by responsibility.
- Deduplicate prompt-run queue orchestration into one shared service.
- Remove `@onescope/ui` self-import pattern in `packages/ui/src/components/sidebar.tsx`.

## ⚡ High Priority — Fix This Week
- Move scheduling/cron logic out of routers.
- Move dashboard data transformation to typed service adapters.
- Add static boundary checks in CI (dependency-cruiser or ESLint import rules).

## 🟡 Medium Priority — Improve Soon
- Introduce use-case naming conventions across services (`runPromptBatch`, `scheduleWorkspaceRun`, `fetchWorkspaceAnalysis`).
- Introduce explicit interfaces for external provider adapters.

## 💤 Later Improvements
- Add architecture decision records (ADRs) for queueing, schedule orchestration, and data stores.
- Add module-level ownership annotations for contributor routing.
