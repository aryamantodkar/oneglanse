# Architecture

## Monorepo layout

- `apps/web` handles auth, dashboard UI, and tRPC routes.
- `apps/agent` handles provider automation and response extraction.
- `packages/services` contains queue, prompt, workspace, and analysis services.
- `packages/db` provides Postgres and ClickHouse clients/schemas.

## Request and processing flow

1. User triggers a run from `apps/web`.
2. Job group is queued into Redis/BullMQ (one job per provider).
3. `apps/agent` workers consume jobs and run provider sessions.
4. Responses and sources are stored in ClickHouse.
5. Analysis runs and writes derived metrics to ClickHouse.
6. Dashboard queries display prompt-level and aggregate GEO metrics.
