# Dependency Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- "`packages/ui` self-import dependency issue" is resolved in code.

## New Improvements Missed Last Time
1. `.github/workflows/docker-build.yml:30`
- Fix: use pnpm `10.16.0` to match root `package.json:26`.
- Why: toolchain mismatch causes non-reproducible CI behavior.

2. `packages/db/package.json` (`dependencies.drizzle-kit`)
- Fix: move to `devDependencies`.
- Why: build-time tool should not be shipped runtime dependency.

3. `apps/agent/package.json` / `apps/web/package.json`
- Fix: run `knip`/dep audit and remove unused runtime SDKs.
- Why: lower install surface, fewer CVE vectors, smaller images.

## Version Policy
- Define workspace-level pinned ranges for `bullmq`, `ioredis`, `openai`, `@types/node`.
