# OneGlanse Monorepo

OneGlanse tracks how AI providers mention your brand by running scheduled prompts across LLMs, storing responses, and analyzing visibility/sentiment/position metrics.

This repository is a `pnpm` + Turborepo monorepo with:
- Product app (`apps/web`)
- Browser automation worker (`apps/agent`)
- Landing site (`apps/landing`)
- Docs site (`apps/docs`)
- Shared workspace packages under `packages/*`

## Repository Layout

| Path | Role |
| --- | --- |
| `apps/web` | Main authenticated product app (Next.js + tRPC) |
| `apps/agent` | BullMQ + Playwright worker that executes provider jobs |
| `apps/landing` | Public marketing website |
| `apps/docs` | Public technical documentation (Nextra) |
| `packages/db` | Database schema/clients (Postgres + ClickHouse) |
| `packages/services` | Business/service layer used by apps |
| `packages/types` | Shared TypeScript domain types |
| `packages/ui` | Shared React UI component library |
| `packages/utils` | Shared utility helpers |
| `packages/errors` | Shared error classes + error helpers |

## Tech Stack

- Monorepo: Turborepo + pnpm workspaces
- Web framework: Next.js 15 (App Router)
- API: tRPC
- Auth: Better Auth
- Queue: BullMQ + Redis
- Browser automation: Playwright
- Databases: PostgreSQL + ClickHouse
- ORM: Drizzle ORM
- Styling: Tailwind CSS + shared `@oneglanse/ui`
- Validation: Zod

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose (recommended for infra)

## Quick Start (Local)

1. Install dependencies:

```bash
pnpm install
```

2. Create environment files:

```bash
cp .env.example .env
cp apps/agent/.env.example apps/agent/.env
```

3. Start infra services (Postgres, ClickHouse, Redis):

```bash
docker compose up -d db clickhouse redis
```

4. Run DB migrations:

```bash
pnpm db:migrate
```

5. Start applications (separate terminals):

```bash
pnpm dev:web
pnpm dev:agent
pnpm dev:landing
pnpm dev:docs
```

## Root Scripts

| Command | Description |
| --- | --- |
| `pnpm build` | Build all workspaces through Turbo |
| `pnpm dev` | Run all dev tasks through Turbo |
| `pnpm dev:web` | Start only `@oneglanse/web` |
| `pnpm dev:agent` | Start only `@oneglanse/agent` |
| `pnpm dev:landing` | Start only `@oneglanse/landing` |
| `pnpm dev:docs` | Start only `@oneglanse/docs` |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm lint` | Run lint pipelines |
| `pnpm clean` | Clear Turbo outputs and root `node_modules` |
| `pnpm db:generate` | Generate Drizzle files via `@oneglanse/db` |
| `pnpm db:migrate` | Run migrations via `@oneglanse/db` |
| `pnpm db:push` | Push schema via `@oneglanse/db` |
| `pnpm db:studio` | Open Drizzle Studio via `@oneglanse/db` |

## Environment Variables

Primary variables used across services (see `.env.example`):

- Database:
  - `DATABASE_URL`
  - `CLICKHOUSE_URL`
  - `CLICKHOUSE_DB`
  - `CLICKHOUSE_USER`
  - `CLICKHOUSE_PASSWORD`
- Auth and web:
  - `APP_URL`
  - `API_BASE_URL`
  - `BETTER_AUTH_URL`
  - `NEXT_PUBLIC_API_URL`
  - `BETTER_AUTH_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- Queue/worker:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD`
  - `REDIS_URL`
  - `AGENT_WORKER_CONCURRENCY`
- Internal operations:
  - `INTERNAL_CRON_SECRET`
  - `OPENAI_API_KEY`
  - `DEBUG_ENABLED`
  - `PROXY`
  - `PROXY_USERNAME`
  - `PROXY_PASSWORD`

Agent proxy notes: `PROXY` accepts `host:port` plus `http(s)://`/`socks5://` URLs; if `PROXY_USERNAME` contains a session token (`sessid`, `session`, `session_id`, `{{SESSID}}`, `$SESSID`), workers rotate it automatically per launch.

## Runtime Data Flow

1. User configures prompts and workspace settings in `apps/web`.
2. `apps/web` submits job groups via `@oneglanse/services` (`submitAgentJobGroup`).
3. Jobs are pushed to provider queues in Redis/BullMQ.
4. `apps/agent` workers consume jobs, run provider browser sessions, and store prompt responses.
5. Analysis jobs process responses into structured metrics.
6. `apps/web` reads analysis data and renders dashboard/prompts views.

## Workspace Standards

- App-level business logic should call `@oneglanse/services`.
- Cross-app contracts should live in `@oneglanse/types`.
- Reusable presentational UI should live in `@oneglanse/ui`.
- Generic helpers should live in `@oneglanse/utils`.
- Shared error primitives should come from `@oneglanse/errors`.

## Contributor Navigation

Start here based on task type:

- Product/API behavior: `apps/web` + `packages/services`
- Provider automation / queue behavior: `apps/agent` + `packages/services/src/agent`
- Data/schema work: `packages/db`
- Shared contracts: `packages/types`
- Shared components: `packages/ui`
- Generic helpers: `packages/utils`

## Current OSS Notes

- Per-workspace READMEs are provided in every `apps/*` and `packages/*` directory.
- Review each workspace README for exact scripts, env vars, and folder maps before making changes.
