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
- Browser automation: Camoufox + Playwright
- Databases: PostgreSQL + ClickHouse
- ORM: Drizzle ORM
- Styling: Tailwind CSS + shared `@oneglanse/ui`
- Validation: Zod

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose (recommended for infra)

## Local Run

This is the full local development flow. In local mode:

- the worker does **not** use proxies
- provider login happens on **this machine**
- auth bundles are stored under `.oneglanse-storage/auth`
- persistent runtime browser profiles are stored under `.oneglanse-storage/runtime`

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create environment files

```bash
cp .env.example .env
cp apps/agent/.env.example apps/agent/.env
```

Keep these defaults for local development:

- `.env`
  - `AGENT_RUNTIME_ENV=local`
- `apps/agent/.env`
  - `AGENT_RUNTIME_ENV=local`
  - leave `AGENT_AUTH_UPLOAD_URL` and `AGENT_AUTH_UPLOAD_TOKEN` unset unless you are capturing auth for a VPS

### 3. Start local infrastructure

```bash
docker compose up -d db clickhouse redis
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Start the app and the agent

Run these in separate terminals:

```bash
pnpm dev:web
pnpm dev:agent
```

Optional:

```bash
pnpm dev:landing
pnpm dev:docs
```

### 6. Sign in to providers locally

You have two ways to reach the same shared connections module:

- full app mode: open the app normally and it will redirect to `/connections` if any provider auth is missing
- isolated mode: open `http://localhost:3000/provider-connections`

Then:

1. Click `Connect with ChatGPT`, `Connect with Perplexity`, `Connect with Google`, or `Connect with Claude`
2. A local browser window opens for that provider
3. Sign in
4. After the session is captured and saved, the UI shows a checkmark for that provider group

Google is shared:

- one Google auth bundle covers both `gemini` and `ai-overview`

### 7. How local auth is reused

Local auth uses two layers of state:

- portable auth bundles
  - `.oneglanse-storage/auth/sessions/<authProvider>/<authProvider>-auth.json`
- persistent runtime profiles
  - `.oneglanse-storage/runtime/<provider>/profile`

Runtime behavior:

- when a provider runtime profile does not exist, it is seeded from the saved auth bundle
- when the auth bundle changes, that runtime profile is invalidated and reseeded on the next run
- otherwise the provider reuses its persistent Camoufox profile directly

This means:

- `storageState` is the portable source of truth
- persistent profile directories are the execution state on that machine

## VPS Run

This is the production/VPS flow. In VPS mode:

- the worker **does** use proxies, if proxy env vars are set
- the VPS never opens an interactive login browser
- auth bundles and runtime profiles are persisted on the VPS host under a bind-mounted storage directory
- the user captures auth locally and uploads it to the VPS

### 1. Prepare persistent host storage on the VPS

Create a host directory that will survive container restarts:

```bash
sudo mkdir -p /opt/oneglanse/storage
sudo chown -R "$USER":"$USER" /opt/oneglanse/storage
```

### 2. Configure VPS environment

Set these in your VPS environment:

- `.env`
  - `AGENT_STORAGE_HOST_PATH=/opt/oneglanse/storage`
- `apps/agent/.env`
  - `AGENT_RUNTIME_ENV=vps`
  - `AGENT_AUTH_ROOT_DIR=/storage/auth`
  - `AGENT_API_HOST=0.0.0.0`
  - `AGENT_API_PORT=3333`
  - `AGENT_AUTH_UPLOAD_TOKEN=<long-random-token>`
  - proxy settings as needed:
    - `PROXY_PROVIDER`
    - `PROXY_SCHEME`
    - `PROXY_HOST`
    - `PROXY_PORT`
    - `PROXY_USERNAME`
    - `PROXY_PASSWORD`
    - `THORDATA_PROXY_API_URL` when using ThorData

Notes:

- proxies are used only when `AGENT_RUNTIME_ENV=vps`
- `docker-compose.yml` mounts `${AGENT_STORAGE_HOST_PATH}` into both containers as `/storage`
- `agent-worker` gets write access
- `web` gets read-only access for connection status visibility

### 3. Start the VPS stack

```bash
docker compose up -d
```

That gives you:

- `web`
- `agent-worker`
- `redis`
- `db`
- `clickhouse`

### 4. Capture auth locally for the VPS

Do this on your **local machine**, not on the VPS.

In your local checkout:

1. Copy env files if you have not already:

```bash
cp .env.example .env
cp apps/agent/.env.example apps/agent/.env
```

2. Configure the local machine for auth capture:

- `.env`
  - `AGENT_RUNTIME_ENV=local`
- `apps/agent/.env`
  - `AGENT_RUNTIME_ENV=local`
  - `AGENT_AUTH_UPLOAD_URL=https://<your-vps-host>:3333/auth/sessions`
  - `AGENT_AUTH_UPLOAD_TOKEN=<same-token-as-vps>`

3. Start the local app and local agent:

```bash
pnpm dev:web
pnpm dev:agent
```

4. Open:

```text
http://localhost:3000/provider-connections
```

5. Connect each provider locally

What happens on each successful connection:

- the auth bundle is saved locally first
- the bundle is gzip-compressed and uploaded to the VPS
- the VPS writes it to `/storage/auth/sessions/...`
- affected runtime profiles on the VPS are invalidated
- the next VPS run reseeds from the uploaded bundle

### 5. How auth is reused on the VPS

VPS storage layout:

- auth bundles
  - `/storage/auth/sessions/<authProvider>/<authProvider>-auth.json`
- auth status
  - `/storage/auth/status/<authProvider>.json`
- persistent runtime profiles
  - `/storage/runtime/<provider>/profile`

Runtime behavior on the VPS:

- if `/storage/runtime/<provider>/profile` does not exist, the worker seeds it from the corresponding auth bundle
- if the saved auth bundle hash changed, the worker rebuilds that runtime profile from the new bundle
- otherwise it launches the existing persistent Camoufox profile directly

Provider mapping:

- `chatgpt` auth bundle -> `chatgpt` runtime profile
- `perplexity` auth bundle -> `perplexity` runtime profile
- `claude` auth bundle -> `claude` runtime profile
- `google` auth bundle -> both:
  - `gemini` runtime profile
  - `ai-overview` runtime profile

### 6. Important VPS rule

Do **not** try to log in on the VPS.

On the VPS:

- `/connections` and `/provider-connections` are status/control screens only
- interactive connect is disabled there by design
- if auth is missing, use the same connections page on your local machine and upload the sessions to the VPS

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
  - `AGENT_RUNTIME_ENV`
  - `AGENT_AUTH_ROOT_DIR`
  - `AGENT_AUTH_UPLOAD_URL`
  - `AGENT_AUTH_UPLOAD_TOKEN`
  - `AGENT_STORAGE_HOST_PATH`
- Internal operations:
  - `INTERNAL_CRON_SECRET`
  - `OPENAI_API_KEY`
  - `DEBUG_ENABLED`
  - `PROXY_HOST`
  - `PROXY_PORT`
  - `PROXY_USERNAME`
  - `PROXY_PASSWORD`

Agent proxy notes:

- set `PROXY_HOST` + `PROXY_PORT`
- add `PROXY_USERNAME` + `PROXY_PASSWORD` for authenticated providers
- proxies are ignored in local mode and only applied when `AGENT_RUNTIME_ENV=vps`

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
