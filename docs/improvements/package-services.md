# package-services Audit (`@onescope/services`)

## 1. Structural Issues
- `packages/services/src/prompt/index.ts` is overloaded with:
  - prompt storage,
  - cron scheduling SQL,
  - response storage,
  - source aggregation fetch logic.
- Move and split:
  - `packages/services/src/prompt/index.ts`
  - to:
    - `packages/services/src/prompt/storePrompts.ts`
    - `packages/services/src/prompt/storePromptResponses.ts`
    - `packages/services/src/prompt/fetchPromptResponses.ts`
    - `packages/services/src/scheduling/cronScheduler.ts`
- `packages/services/src/analysis/analysis.ts` contains multiple responsibilities:
  - analysis execution loop,
  - persistence updates,
  - read-model fetch.
- Move:
  - `analysePromptsForWorkspace` write pipeline to `packages/services/src/analysis/runWorkspaceAnalysis.ts`.
  - read-model fetch to `packages/services/src/analysis/fetchWorkspaceAnalysis.ts`.
- Queue bootstrap duplication exists outside package (web routers), meaning service boundary is incomplete.
  - Add `packages/services/src/agent/startPromptRun.ts` and reuse from web routers.

## 2. Architectural Problems
- Cohesion is low in prompt module; it is effectively a god-module.
- Separation of concerns is weak:
  - SQL string building, transport payload construction, and domain decisions are mixed.
- Dependency direction is mostly correct, but abstraction is incomplete.
- Missing interfaces:
  - no explicit scheduler adapter interface.
  - no explicit analysis trigger policy interface.
- Corrected architecture:
  - `domain` services for prompt/schedule/analysis use-cases.
  - `infra` adapters for ClickHouse/Postgres/Redis/queue.

## 3. Code Quality Audit
- `packages/services/src/prompt/index.ts`
  - Problem: interpolated SQL in `scheduleCronForPrompts` embeds secret and IDs into SQL payload text.
  - Exact change: parameterize all dynamic values and validate URL/cron input before scheduling.
  - Production impact: SQL injection and config fragility.
- `packages/services/src/prompt/index.ts`
  - Problem: raw interpolated ClickHouse queries in `fetchPromptResponsesForWorkspace` and `fetchUserPromptsForWorkspace`.
  - Exact change: use query params (`{workspaceId:String}`).
  - Production impact: unsafe query construction.
- `packages/services/src/analysis/analysis.ts`
  - Problem: `rows: any[]` and broad `catch (err: any)`.
  - Exact change: strict row typing and typed error guards.
  - Production impact: parsing bugs hidden until runtime.
- `packages/services/src/agent/redis.ts`
  - Problem: hardcoded `port: 6379` ignores env port used elsewhere.
  - Exact change: use parsed `REDIS_PORT` consistently.
  - Production impact: deployment config mismatch failures.
- `packages/services/src/prompt/index.ts`
  - Problem: fallback insert loop logs and suppresses complete failure in some paths.
  - Exact change: return typed partial failure result and propagate appropriately.
  - Production impact: data-loss scenarios can be silently accepted.

## 4. Testing Requirements
### Missing Unit Tests
- prompt dedupe and delete behavior in store function.
- cron schedule SQL payload builder (after extraction).
- analysis row transformation and metadata merge logic.

### Missing Integration Tests
- ClickHouse insert/update flow for analysis and prompt responses.
- Redis queue/progress key lifecycle.
- Postgres cron schedule/unschedule behavior.

### Missing Contract Tests
- cross-package contract for `ModelResult` and `PromptResponse` structures used by web and agent.

### CI Enforcement
- run service integration tests in dockerized CI profile with ClickHouse + Redis + Postgres.

## 5. Production Hardening
- Missing query-safety guardrails for raw SQL strings.
- No standardized timeout/retry envelope around DB operations.
- No idempotency key strategy for schedule-triggered runs.
- Minimal fix:
  - extract DB adapters with typed query helpers and bounded retries.
  - add idempotency key (workspace + scheduled window) for run bootstrap.
- Long-term fix:
  - resilient workflow orchestration with dedupe and outbox patterns.

## 6. Dependency Audit
- High-confidence unused dependencies in `packages/services/package.json`:
  - `@anthropic-ai/sdk`
  - `@perplexity-ai/perplexity_ai`
  - `better-auth`
- Version consistency fixes needed:
  - align `openai`, `bullmq`, `ioredis` across workspaces.

## 7. OSS Readiness Audit
- Service package API surface is broad and undocumented.
- No clear distinction between stable public service functions and internal helpers.
- Without docs and tests, external contributors cannot safely modify core pipeline behavior.

## 🔥 Critical — Must Fix Before Open Source
- Remove SQL interpolation and parameterize all dynamic query values.
- Split prompt god-module into focused modules.
- Fix Redis config mismatch (`REDIS_PORT`) and tighten error propagation.

## ⚡ High Priority — Fix This Week
- Add integration tests for prompt/analysis persistence paths.
- Extract shared start-run orchestration into services package.
- Remove unused dependencies and align versions.

## 🟡 Medium Priority — Improve Soon
- Add idempotency and dedupe semantics for scheduled runs.
- Add typed repository/adapters for data store calls.

## 💤 Later Improvements
- Add per-use-case latency/error metrics.
- Introduce background workflow orchestration abstraction for retries and compensation.
