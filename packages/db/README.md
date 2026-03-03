# @oneglanse/db

Database package containing schema definitions, environment validation, and client instances for PostgreSQL and ClickHouse.

## Responsibilities

- Define Drizzle schema for auth/org/workspace data.
- Provide typed Postgres client (`db`) for transactional data.
- Provide ClickHouse client (`clickhouse`) for analytics tables.
- Provide migration/generation scripts used by apps.

## Exports

From `src/index.ts`:

- `schema` (all schema modules)
- `db` (Drizzle over `postgres` driver)
- `pool` (raw `pg` pool for operational SQL like `pg_cron`)
- `clickhouse` client
- shared DB types

## Structure

- `src/schema/auth.ts`: Better Auth + org/member tables.
- `src/schema/workspace.ts`: workspace/workspace_members tables.
- `src/clients/postgres.ts`: Drizzle + pg pool setup.
- `src/clients/clickhouse.ts`: ClickHouse client setup.
- `src/config/*`: required env accessors/config objects.
- `drizzle/`: generated migration artifacts.
- `init-scripts/`, `clickhouse-init/`: container bootstrap SQL.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/db build` | Compile TypeScript |
| `pnpm --filter @oneglanse/db typecheck` | TypeScript checks |
| `pnpm --filter @oneglanse/db db:generate` | Generate migration files |
| `pnpm --filter @oneglanse/db db:migrate` | Run migrations |
| `pnpm --filter @oneglanse/db db:push` | Push schema directly |
| `pnpm --filter @oneglanse/db db:studio` | Open Drizzle Studio |

## Environment Variables

Validated in `src/env.ts`:

- `NODE_ENV`
- `NEXT_PHASE`
- `DATABASE_URL`
- `CLICKHOUSE_URL`
- `CLICKHOUSE_USER`
- `CLICKHOUSE_PASSWORD`
- `CLICKHOUSE_DB`

## Usage

```ts
import { db, clickhouse, schema } from "@oneglanse/db";
```

Use this package as the only DB boundary for app/service code.
