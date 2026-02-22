# Monorepo Overview Audit

## Snapshot
- Verdict: this monorepo is still in prototype mode, not production/OSS mode.
- Blocking risks: no automated tests, weak CI gates, inconsistent dependency versions, package boundary leaks, and incomplete OSS metadata.
- Scope scanned: `/apps/web`, `/apps/agent`, `/packages/*`, root build/config/CI/docker files.

## Workspace Boundaries
- Boundary leak: `apps/web/src/lib/auth/auth.ts` imports `../../../../../packages/db/src/schema/auth` directly.
- Boundary leak: `apps/agent/tsconfig.json` includes `../../packages/errors/src/lib/classifyError.ts` and `../../packages/utils/src/agent/backoff.ts` directly.
- Boundary leak: `packages/ui/src/components/sidebar.tsx` imports `@onescope/ui` from inside the same package, creating self-referential dependency risk.
- Fix in 1–2 days:
  - Replace direct source imports with package exports only.
  - Export auth schema through `@onescope/db` and consume via `@onescope/db`.
  - Remove `packages/*/src/*` includes from app tsconfigs.
  - Replace `@onescope/ui` self-imports with local relative imports in `packages/ui/src/components/sidebar.tsx`.

## Shared Config Strategy
- Config drift exists:
  - Root has `biome.json`; web also has `apps/web/biome.jsonc`.
  - Root `tsconfig.json` exists, but `apps/web/tsconfig.json` does not extend it.
- Missing shared policy files: no `.editorconfig`, no root `eslint` fallback policy, no commit hooks.
- Fix in 1–2 days:
  - Make all workspace tsconfigs extend root base.
  - Move shared Biome rules to root and keep app/package overrides minimal.
  - Add repo-level formatting/lint/test scripts that every workspace must implement.

## Type Sharing Strategy
- `@onescope/types` exists, but app code still uses pervasive `any` and local untyped parsing.
- High-risk typed regressions:
  - `apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts`
  - `apps/web/src/app/(auth)/people/page.tsx`
  - `packages/services/src/analysis/analysis.ts`
- Fix in 1–2 days:
  - Create typed DTOs for tRPC responses used by dashboard/people/prompts pages.
  - Replace top-level `any` surfaces first, starting with dashboard and analysis payloads.

## Build Pipeline, Caching, Incremental Builds
- `turbo.json` has `test` task but repository has no tests.
- `lint` and `typecheck` both depend on `^build`, inflating feedback loop time and hiding static errors behind build failures.
- CI uses pnpm 9 while repo is pinned to pnpm 10.16.0 (`packageManager`), which is unnecessary risk.
- Fix in 1–2 days:
  - Remove `^build` dependency from `lint` and `typecheck` tasks.
  - Add real `test` scripts to each workspace or remove fake task until implemented.
  - Pin CI to pnpm 10.16.0.

## CI/CD Maturity
- Only one workflow exists: `.github/workflows/docker-build.yml`.
- Trigger is hardcoded to branch `onescope-monorepo`, not generic `main`/`pull_request` OSS flow.
- Lint step is commented out.
- No test, coverage, dependency audit, or security scan jobs.
- Fix in 1–2 days:
  - Add `pull_request` and `push` (default branch) triggers.
  - Re-enable lint and add test gate.
  - Add minimal dependency vulnerability scan and secrets scan job.

## Versioning and Release Strategy
- All packages are `private: true` with `version: 0.1.0` and no release process.
- No Changesets, semantic-release, changelog automation, or publish policy.
- Fix in 1–2 days:
  - If staying private: explicitly document internal versioning policy in root docs.
  - If planning OSS package publishing: add Changesets and package visibility strategy.

## Lint/Format Enforcement and Hooks
- `pnpm lint` exists, but CI does not enforce it.
- No pre-commit or pre-push hooks.
- No commit message convention enforcement.
- Fix in 1–2 days:
  - Add Husky + lint-staged for changed files.
  - Add commitlint + conventional commits.
  - Fail CI on lint errors.

## Dead Scripts and Repo Hygiene
- Tracked backup file: `apps/web/src/app/(auth)/dashboard/page.tsx.bak`.
- Tracked environment-specific scratch docs: `ANALYSIS.md`, `apps/web/ANALYSIS.md`.
- Tracked proxy list file: `apps/agent/proxies.txt`.
- Root `.gitignore` does not ignore agent runtime artifacts (`storage/`, debug screenshots).
- Fix in 1–2 days:
  - Delete `.bak` and stale analysis scratch files from git history going forward.
  - Replace `apps/agent/proxies.txt` with `apps/agent/proxies.example.txt` and ignore real runtime files.
  - Update `.gitignore` for agent runtime outputs.

## Developer Ergonomics and Onboarding
- Root `README.md` is too thin for contributor onboarding.
- No `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`, or `CODEOWNERS` detected.
- No documented local test strategy because tests do not exist.
- Fix in 1–2 days:
  - Add missing OSS baseline docs.
  - Add one canonical quickstart path with Docker and non-Docker options.
  - Add architecture map showing app-to-package dependency rules.

## OSS Readiness Verdict
- If published today, serious engineers will treat this as an unreleased internal prototype.
- Main reasons:
  - boundary violations and deep imports,
  - weak CI gates,
  - no tests,
  - no release/versioning process,
  - missing OSS governance files.

## 🔥 Critical — Must Fix Before Open Source
- Enforce package boundaries: remove direct `packages/*/src/*` imports from apps.
- Re-enable lint in CI and add test gate.
- Add minimum OSS docs: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- Remove tracked backup/runtime artifacts (`page.tsx.bak`, real proxy file usage pattern).
- Align CI toolchain versions with repo (`pnpm@10.16.0`).

## ⚡ High Priority — Fix This Week
- Split oversized web files and workspace router into domain modules.
- Standardize env validation across web/agent/services/db.
- Add Changesets (or explicit no-publish policy) and release notes workflow.
- Add pre-commit and commit message enforcement.

## 🟡 Medium Priority — Improve Soon
- Tighten Turbo task graph and caching policy.
- Reduce duplicate per-workspace config by centralizing shared rules.
- Add contributor architecture diagrams and boundary checks.

## 💤 Later Improvements
- Add automated dependency freshness PRs.
- Add architecture fitness tests (import rules, cyclical dependency checks).
