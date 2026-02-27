# package-db Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Any claim that DB package has no environment checks is outdated (checks exist).

## New Improvements Missed Last Time
1. `packages/db/src/config/clickhouse.ts:13`
- Fix: remove default `"password"` fallback in production path.
- Why: insecure default can silently ship.

2. `packages/db/package.json` (`dependencies.drizzle-kit`)
- Fix: move `drizzle-kit` to `devDependencies`.
- Why: migration tooling should not be runtime dependency.

3. `packages/db/src/clients/postgres.ts:22-41`
- Fix: replace proxy-throw fallback with explicit startup failure helper.
- Why: deferred throws make failures occur far from root cause.

4. `packages/db/src/clients/postgres.ts:33-36`
- Fix: make pool sizing env-configurable.
- Why: static pool limits can bottleneck under varying workloads.
