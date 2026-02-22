# package-db Audit (`@onescope/db`)

## 2. Architectural Problems
- Package is cohesive in intent but has infra/bootstrap anti-patterns.
- Violates strict layer separation by mixing config defaults with runtime client creation.
- Unsafe defaults encourage insecure local-to-prod drift:
  - `CLICKHOUSE_PASSWORD` defaults to `password`.
- Corrected structure:
  - `clients/` for runtime clients
  - `schema/` for table definitions only
  - `types/` for inferred models
  - `config/` for validated env schema

## 4. Testing Requirements
### Missing Unit Tests
- schema defaults and constraint assumptions in `packages/db/src/schema/workspace.ts`.
- env/config parsing behavior (after extraction).

### Missing Integration Tests
- connection initialization behavior across env modes.
- migration lifecycle smoke test for `drizzle.config.ts` and migration files.
- ClickHouse connectivity and query smoke test.

### Missing E2E/Contract Tests
- package contract test from `@onescope/services` consumer to ensure schema exports remain stable.

### CI Enforcement
- require migration smoke test in CI.
- require schema type generation check as part of PR validation.

## 5. Production Hardening
- Missing typed env module for DB and ClickHouse config.
- Default insecure credential fallbacks in runtime client setup.
- No built-in health check function exposed from package for service startup checks.
- Minimal fix:
  - add strict env schema and explicit startup checks.
- Long-term fix:
  - expose health probe helpers with timeout and retry policy.

## 6. Dependency Audit
- Move `drizzle-kit` from `dependencies` to `devDependencies`.
- Keep `pg`, `postgres`, `drizzle-orm`, `@clickhouse/client` only if all are required.
- If only one Postgres client is used at runtime, remove the other to reduce footprint.

## 7. OSS Readiness Audit
- Package has clear purpose but not enough contract documentation.
- Missing public docs for expected env vars and migration workflow.
- If published internally/externally, users need explicit compatibility and migration guarantees.

## 🔥 Critical — Must Fix Before Open Source
- Remove schema circular import pattern.
- Remove insecure runtime default credentials/fallbacks.
- Validate required DB env vars explicitly.

## ⚡ High Priority — Fix This Week
- Split client construction from package root exports.
- Add migration and connection integration tests.
- Reclassify tool dependencies.

## 🟡 Medium Priority — Improve Soon
- Add package README with env + migration contract.
- Add health-check helper exports.

## 💤 Later Improvements
- Add connection pool telemetry hooks.
- Add automated migration drift checks against staging snapshots.
