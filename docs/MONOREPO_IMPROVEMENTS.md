# Monorepo Improvements (Current Plan, 2026-02-27)

This file replaces stale broad recommendations with current, verified priorities.

## Removed as No Longer Valid
- UI self-import cycle in `packages/ui/src/components/sidebar.tsx`.
- Separate google-ai-overview worker path (now unified with shared provider pipeline).
- CDP launch being provider-specific (now centralized in `apps/agent/src/lib/browser/launch.ts`).

## Current Priority Backlog
1. `apps/agent/src/lib/utils/runStep.ts:17-33`
- Fix: rethrow after diagnostics.
- Why: prevents silent false-success flows.

2. `apps/agent/src/agents/core/createAgent.ts:29-30`
- Fix: finite default page and navigation timeouts.
- Why: avoids stuck workers.

3. `apps/agent/src/worker/jobHandler.ts:66-96, 143-159`
- Fix: atomic Redis progress updates (Lua/CAS).
- Why: concurrent provider updates can race.

4. `apps/web/middleware.ts:9`
- Fix: remove session logging.
- Why: PII leakage.

5. `apps/web/src/lib/auth/auth.ts:6`
- Fix: eliminate deep import from `packages/db/src/schema/auth`; export via `@onescope/db`.
- Why: package boundary integrity.

6. `packages/services/src/prompt/index.ts:126-144, 285-289, 325-329`
- Fix: parameterize query inputs and remove interpolated scheduler payload secrets.
- Why: security and query consistency.

7. `.github/workflows/docker-build.yml:3-6, 30, 40`
- Fix: OSS-friendly triggers (`main` + `pull_request`), pnpm 10.16.0, re-enable lint.
- Why: reliable CI governance.

8. `turbo.json:15-27`
- Fix: remove unnecessary `^build` dependency from lint/typecheck.
- Why: faster, earlier feedback.

## Short Execution Plan
- Week 1: agent runtime safety + web security hygiene.
- Week 2: service query hardening + boundary cleanup.
- Week 3: CI/test gate hardening.
