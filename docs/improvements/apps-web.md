# apps/web Audit

## 1. Structural Issues
- Delete tracked backup artifact:
  - `apps/web/src/app/(auth)/dashboard/page.tsx.bak`
- Fix route alias misuse:
  - `apps/web/src/app/(auth)/settings/page.tsx` currently re-exports `../people/page`.
  - Change to either:
    - real settings page at `apps/web/src/app/(auth)/settings/page.tsx`, or
    - explicit redirect in route handler with clear intent.
- Split oversized files:
  - `apps/web/src/app/(auth)/prompts/page.tsx` (1335 lines)
  - `apps/web/src/app/(auth)/people/page.tsx` (1133 lines)
  - `apps/web/src/app/(auth)/sources/page.tsx` (933 lines)
  - `apps/web/src/server/api/routers/workspace/workspace.ts` (875 lines)
  - `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts` (543 lines)
- Move duplicated job bootstrap logic:
  - from `apps/web/src/server/api/routers/agent/agent.ts`
  - and `apps/web/src/server/api/routers/internal/internal.ts`
  - to shared service module `packages/services/src/agent/startPromptRun.ts`.
- Boundary violation fix:
  - replace deep import in `apps/web/src/lib/auth/auth.ts`
  - from `../../../../../packages/db/src/schema/auth`
  - to public `@onescope/db` export.
- Move cron timing calculation out of router:
  - from `apps/web/src/server/api/routers/workspace/workspace.ts`
  - to `packages/services/src/scheduling/cronTiming.ts`.
- Code that should be extracted to shared packages:
  - dashboard analytics transformation from `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts`.
  - queue run bootstrap from agent/internal routers.
- Code that should NOT be shared:
  - route-level UI composition and visual state in page components.
  - app-specific middleware and Next.js route conventions.
- Barrel export misuse impact:
  - broad service/util barrels make import surfaces too permissive; app imports too much without explicit contract boundaries.

## 2. Architectural Problems
- Not modular enough in practice.
- Clean architecture violations:
  - route handlers contain orchestration + business rules + persistence + queue wiring.
  - UI pages contain data normalization and domain logic.
- SOLID violations:
  - Single responsibility broken in `workspace.ts` and large pages.
- Dependency inversion violations:
  - app reaches package internals (`packages/db/src/*`).
- Premature abstraction plus under-abstraction simultaneously:
  - many wrappers (`safeHandler`) but no clean domain/use-case split.
- Corrected structure:
  - `apps/web/src/server/api/routers/workspace/workspace.router.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.members.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.schedule.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.join.ts`
  - `apps/web/src/app/(auth)/prompts/_lib/adapters/*`
  - `apps/web/src/app/(auth)/people/_lib/adapters/*`

## 3. Code Quality Audit
- `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts`
  - Problem: accepts `analysedPromptData: any` and uses repeated `as any` casts.
  - Change: introduce typed input DTO and remove all unchecked casts.
  - Production impact: silent runtime shape mismatches and broken dashboards.
- `apps/web/src/server/api/routers/workspace/workspace.ts`
  - Problem: multiple `Promise<any>` and `catch (err: any)` paths.
  - Change: strict return types and typed error normalization.
  - Production impact: hidden failures and inconsistent API responses.
- `apps/web/src/app/(auth)/prompts/page.tsx` + `packages/utils/src/format/formatMarkdown.ts`
  - Problem: HTML rendering path with `dangerouslySetInnerHTML` and unsanitized markdown output.
  - Change: sanitize output or move to safe markdown renderer.
  - Production impact: stored XSS risk.
- `apps/web/middleware.ts`
  - Problem: logs full session object.
  - Change: remove log or redact.
  - Production impact: PII leak in logs.
- `apps/web/src/server/api/middleware/timingMiddleware.ts`
  - Problem: random artificial delay in dev and console logging middleware.
  - Change: remove artificial delay; use proper timing instrumentation.
  - Production impact: poor debugging signal and inconsistent local behavior.
- `apps/web/src/app/(auth)/layout.tsx`
  - Problem: `cookieStore.get("sidebar_state")?.value === "true" || true` always resolves to true.
  - Change: explicit fallback only when cookie is undefined.
  - Production impact: broken persisted sidebar state.
- `apps/web/src/components/forms/login-form.tsx`, `apps/web/src/components/forms/signup-form.tsx`, `apps/web/src/components/forms/logout.tsx`
  - Problem: direct `console.log(err)` in auth flows.
  - Change: use centralized logger and user-safe error mapping.
  - Production impact: noisy logs and potential sensitive error leakage.

## 4. Testing Requirements
### Missing Unit Tests
- `apps/web/src/lib/workspace/joinCode.ts`
- `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts`
- cron timing helper once extracted from `workspace.ts`

### Missing Integration Tests
- `apps/web/src/server/api/routers/workspace/workspace.ts`
- `apps/web/src/server/api/routers/agent/agent.ts`
- `apps/web/src/server/api/routers/internal/internal.ts`
- `apps/web/src/server/api/routers/prompt/prompt.ts`

### Missing E2E Tests
- login -> workspace creation -> prompt submission -> run -> dashboard render
- schedule update flow and job trigger visibility
- auth callback flow (`/api/auth/[...all]`)
- error paths for empty prompts, unauthorized workspace access, and internal secret failures

### Test Structure and CI
- Add:
  - `apps/web/src/__tests__/unit/*`
  - `apps/web/src/__tests__/integration/*`
  - `apps/web/e2e/*`
- Enforce in CI: lint + typecheck + tests required for merge.

## 5. Production Hardening
- Missing global error boundary strategy for app router errors.
- Inconsistent logging; no structured request-level tracing.
- No explicit input schema for many route-side derived values.
- No rate limits on internal run triggers exposed via server-side paths.
- Potential async race in duplicated run bootstrap (agent/internal routers).
- Weak environment validation surface; many runtime env values are unvalidated.
- Minimal viable fixes:
  - central logger + request ID middleware.
  - full env schema in `apps/web/src/env.js`.
  - extract and reuse one run bootstrap service.
  - sanitize markdown HTML path.
- Long-term scalable fixes:
  - standardized API error taxonomy (throw `TRPCError` instead of wrapping all with `safeHandler`).
  - telemetry: traces around prompt queue lifecycle and router latency.

## 6. Dependency Audit
- Remove high-confidence unused dependencies from `apps/web/package.json`:
  - `axios`, `node-fetch`, `openai`, `@anthropic-ai/sdk`, `@perplexity-ai/perplexity_ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/react`, `cheerio`, `country-state-city`, `cron-parser`, `cronstrue`, `date-fns-tz`, `uuid`.
- Reclassify/move dependencies:
  - keep infra clients (`pg`, `redis`) in service/db packages unless directly imported.
- Version consistency fixes:
  - align `better-auth`, LLM SDKs, and `@types/node` with workspace policy.

## 7. OSS Readiness Audit
- `apps/web/README.md` is marketing-level, not contributor-level.
- No explicit API boundary docs for tRPC routers.
- No examples for writing tests or adding routes safely.
- If published now, external contributors will break boundaries because contract rules are undocumented.

## 8. Required Rename/Move Commands
- Move:
  - `apps/web/src/server/api/routers/workspace/workspace.ts`
  - to `apps/web/src/server/api/routers/workspace/workspace.router.ts`
- Add:
  - `apps/web/src/server/api/routers/workspace/workspace.members.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.schedule.ts`
  - `apps/web/src/server/api/routers/workspace/workspace.join.ts`
- Move:
  - queue bootstrap from `apps/web/src/server/api/routers/agent/agent.ts`
  - and `apps/web/src/server/api/routers/internal/internal.ts`
  - to `packages/services/src/agent/startPromptRun.ts`
- Delete:
  - `apps/web/src/app/(auth)/dashboard/page.tsx.bak`

## 🔥 Critical — Must Fix Before Open Source
- Remove deep package-internal imports.
- Remove tracked `.bak` artifact.
- Sanitize markdown HTML rendering path.
- Split `workspace.ts` and deduplicate run bootstrap logic.
- Remove session logging and auth flow `console.log` calls.

## ⚡ High Priority — Fix This Week
- Type all major page data flows (eliminate top-level `any` usage).
- Add integration tests for routers with workspace authz cases.
- Unify error propagation strategy in tRPC layer.

## 🟡 Medium Priority — Improve Soon
- Move dashboard analytics transforms into typed adapter modules.
- Add structured tracing/metrics around prompt run flows.
- Standardize dependency versions and remove dead dependencies.

## 💤 Later Improvements
- Add performance tests for very large prompt-response datasets.
- Add storybook/component tests for shared app-shell UI behavior.
