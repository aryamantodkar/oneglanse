# Production Checklist Audit

## Runtime Safety
- [ ] Global unhandled error strategy is standardized across apps.
  - Evidence: `apps/agent/src/index.ts` exits process on uncaught/unhandled without structured incident context.
  - Minimal fix: emit structured fatal log payload and flush before exit.
  - Long-term fix: integrate centralized error tracker and crash-loop alerting.
- [ ] Web middleware does not log sensitive session objects.
  - Evidence: `apps/web/middleware.ts` logs full session.
  - Minimal fix: remove session logging immediately.
  - Long-term fix: PII-safe logging policy with redaction helpers.

## Input Validation and Request Safety
- [ ] Agent API request body is schema-validated.
  - Evidence: `apps/agent/src/api.ts` parses JSON without schema validation.
  - Minimal fix: zod schema for `/upload-sessions` payload.
  - Long-term fix: typed request pipeline with centralized validators.
- [ ] Internal schedule endpoint payload construction is parameterized.
  - Evidence: `packages/services/src/prompt/index.ts` interpolates env/workspace/user values into SQL text.
  - Minimal fix: pass inputs through SQL parameters and escape rules.
  - Long-term fix: isolate scheduler adapter and use parameter-safe query builder.

## Data and Query Safety
- [ ] ClickHouse query parameters are used consistently.
  - Evidence: string interpolation in:
    - `packages/services/src/prompt/index.ts` (`fetchPromptResponsesForWorkspace`)
    - `packages/services/src/prompt/index.ts` (`fetchUserPromptsForWorkspace`)
  - Minimal fix: switch to `{workspaceId:String}` query params.
  - Long-term fix: wrapper utilities that forbid raw interpolated queries.

## Timeouts, Retries, and Backpressure
- [ ] Browser automation has finite default timeouts.
  - Evidence: `apps/agent/src/agents/core/createAgent.ts` sets `page.setDefaultTimeout(0)` and `page.setDefaultNavigationTimeout(0)`.
  - Minimal fix: restore bounded defaults and make them env-configurable.
  - Long-term fix: policy-based timeout tiers per step type.
- [ ] Queue progress updates are concurrency-safe.
  - Evidence: `apps/agent/src/worker/jobHandler.ts` does read-modify-write on Redis JSON state without locking/CAS.
  - Minimal fix: serialize updates via Lua/CAS key versioning.
  - Long-term fix: store per-provider progress keys and compute aggregate server-side.

## Observability
- [ ] Structured logging is standardized.
  - Evidence: mixed `console.log`, ad-hoc logger, and emoji logs across codebase.
  - Minimal fix: single logger interface in all packages/apps.
  - Long-term fix: JSON logs + trace IDs + ingestion pipeline.
- [ ] Metrics and tracing exist for queue latency, retries, and failure classes.
  - Evidence: no trace/metric instrumentation despite complex retry/proxy flow.
  - Minimal fix: capture counters/timers around prompt run lifecycle.
  - Long-term fix: OpenTelemetry + dashboards + SLO alerts.

## Environment and Configuration
- [ ] Env validation is complete for runtime-critical variables.
  - Evidence: `apps/web/src/env.js` validates only `DATABASE_URL` and `NODE_ENV`; runtime uses many additional env vars.
  - Minimal fix: add full schemas for web/agent/services/db runtime vars.
  - Long-term fix: package-specific typed config modules with fail-fast startup.
- [ ] Example env files are parse-safe.
  - Evidence: `.env.example` contains `KEY = value` entries with spaces.
  - Minimal fix: change to strict `KEY=value` format.
  - Long-term fix: auto-validated env template generation.

## Security Controls
- [ ] Rate limiting exists on sensitive API endpoints.
  - Evidence: no request throttling on `apps/agent/src/api.ts`.
  - Minimal fix: token-bucket per IP/token for `/upload-sessions`.
  - Long-term fix: gateway-level + app-level layered rate limiting.
- [ ] Sensitive files are excluded from repository and artifacts.
  - Evidence: `apps/agent/proxies.txt` is tracked; `.gitignore` does not cover agent runtime storage/debug artifacts.
  - Minimal fix: replace with example file and ignore runtime outputs.
  - Long-term fix: repo secrets guard + policy checks in CI.

## Deployment and CI Gates
- [ ] CI enforces lint, typecheck, tests.
  - Evidence: lint command is commented in `.github/workflows/docker-build.yml`; tests absent.
  - Minimal fix: re-enable lint and add test job.
  - Long-term fix: branch protection requiring quality gates and coverage thresholds.
- [ ] CI trigger is OSS-friendly.
  - Evidence: workflow triggers only on branch `onescope-monorepo`.
  - Minimal fix: add `pull_request` and default branch push triggers.
  - Long-term fix: release workflows per app image and tag channels.

## Release Hygiene
- [ ] No temporary artifacts in tracked source tree.
  - Evidence: `apps/web/src/app/(auth)/dashboard/page.tsx.bak` tracked in git.
  - Minimal fix: remove file and enforce ignore rules.
  - Long-term fix: pre-commit rule blocking backup/temp files.

## 🔥 Critical — Must Fix Before Open Source
- Remove session logging in middleware.
- Parameterize all interpolated SQL in services prompt module.
- Add schema validation and rate limiting to agent API.
- Re-enable lint in CI and add test gate.
- Remove tracked `.bak`/runtime-sensitive artifacts.

## ⚡ High Priority — Fix This Week
- Restore finite browser/page timeouts.
- Make Redis progress updates race-safe.
- Standardize logging and add minimal metrics.
- Enforce full env validation for all runtime vars.

## 🟡 Medium Priority — Improve Soon
- Consolidate retry/backoff policy into reusable utilities.
- Add SLO-based alerting for queue latency and error rates.
- Add load-test scenario for multi-provider concurrent runs.

## 💤 Later Improvements
- Add chaos tests for Redis/ClickHouse outages.
- Add automatic rollback strategy for failed deploy health checks.
