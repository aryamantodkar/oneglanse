# package-services Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Claim that all ClickHouse queries are parameterized is not true in current code.

## New Improvements Missed Last Time
1. `packages/services/src/prompt/index.ts:126-144`
- Fix: stop interpolating `API_BASE_URL`, `workspaceId`, `userId`, and secret into `scheduledSQL` string.
- Why: unsafe construction and brittle quoting; move to parameter-safe scheduling payload pattern.

2. `packages/services/src/prompt/index.ts:285-289, 325-329`
- Fix: parameterize `workspace_id` in fetch queries (`query_params`).
- Why: raw interpolation is avoidable and inconsistent with other safe queries.

3. `packages/services/src/prompt/index.ts:65-97, 230-275`
- Fix: replace console fallback insert loops with typed partial-failure result + centralized logger.
- Why: current approach can silently degrade data quality.

4. `packages/services/src/agent/redis.ts:6`
- Fix: use `REDIS_PORT` env (not hardcoded `6379`).
- Why: breaks non-default deployments.

5. `packages/services/src/analysis/analysis.ts:123, 233`
- Fix: remove `any` in error/row handling; define typed row DTO and parser.
- Why: runtime parse failures are currently under-typed.
