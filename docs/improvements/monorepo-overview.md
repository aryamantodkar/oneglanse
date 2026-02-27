# Monorepo Overview (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- `packages/ui/src/components/sidebar.tsx` self-import violation is resolved.
- Separate `google-ai-overview` runner path is removed; provider now uses shared pipeline.
- CDP launch strategy is no longer provider-specific; it is centralized.

## New Improvements Missed Last Time
1. `apps/agent/src/lib/utils/runStep.ts:17-33`
- Fix: rethrow after diagnostics capture.
- Why: current behavior logs failures but returns success, causing hidden downstream corruption.

2. `apps/agent/src/agents/core/createAgent.ts:29-30`
- Fix: replace `setDefaultTimeout(0)` and `setDefaultNavigationTimeout(0)` with bounded env-driven values.
- Why: infinite timeouts can hang workers and block queue throughput.

3. `apps/web/src/lib/auth/auth.ts:6`
- Fix: replace deep import from `packages/db/src/schema/auth` with `@onescope/db` export.
- Why: deep source imports break package boundaries and build graph stability.

4. `apps/agent/tsconfig.json:18`
- Fix: remove direct includes of `../../packages/*/src/*`; consume package outputs/contracts only.
- Why: bypasses monorepo package contracts and creates hidden coupling.

5. `.github/workflows/docker-build.yml:3-6, 30, 40`
- Fix: move trigger from feature branch to `main` + `pull_request`, use pnpm 10.16.0, and re-enable lint.
- Why: current CI is not OSS-grade and permits style regressions.

6. `turbo.json:15-27`
- Fix: remove `^build` dependency from `lint` and `typecheck` tasks.
- Why: static checks should fail fast without requiring full builds.

## Execution Order
1. Boundary enforcement (`auth.ts`, `apps/agent/tsconfig.json`)
2. Runtime safety (`runStep.ts`, `createAgent.ts` timeouts)
3. CI modernization (`docker-build.yml`, `turbo.json`)
