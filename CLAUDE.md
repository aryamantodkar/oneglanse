# OneScope AI

## Project Overview

AI-powered brand monitoring platform that runs prompts across ChatGPT, Claude, and Perplexity via browser automation, then analyzes brand mentions, sentiment, and visibility in LLM responses.

## Monorepo Structure

```
apps/
  web/        → Next.js 15 (App Router) — dashboard, tRPC API, auth
  agent/      → Node.js — Playwright browser automation, BullMQ worker
packages/
  db/         → Drizzle ORM (PostgreSQL) + ClickHouse client
  types/      → Shared TypeScript definitions
  services/   → Business logic (queues, Redis, prompts, analysis, LLM)
  errors/     → Custom error classes (AuthError, DatabaseError, etc.)
  utils/      → Utility functions (cn, formatters, extractors)
  ui/         → Radix UI + Tailwind component library
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Package manager | pnpm 10 |
| Build system | Turborepo |
| Web framework | Next.js 15 (App Router, server components) |
| API | tRPC 11 (superjson transformer) |
| Auth | better-auth (Google OAuth + email/password) |
| State | TanStack React Query 5 |
| Styling | Tailwind CSS 4 |
| Primary DB | PostgreSQL (Drizzle ORM) |
| Analytics DB | ClickHouse |
| Queue | BullMQ (Redis-backed) |
| Browser automation | Playwright + playwright-extra (stealth plugin) |
| Linting | Biome |
| Module system | ESM everywhere (`"type": "module"`) |
| TypeScript | 5.8+ with strict mode |

## Key Architecture

### Web App (`apps/web`)

- **tRPC routers** in `src/server/api/routers/` — agent, prompt, analysis, workspace
- **Procedures**: `publicProcedure`, `protectedProcedure`, `authorizedWorkspaceProcedure`, `internalProcedure`
- **Auth config** in `src/lib/auth/auth.ts` (better-auth with Drizzle adapter)
- **Query client** staleTime: 30s (in `src/trpc/query-client.ts`)

### Agent (`apps/agent`)

- **Worker** (`src/worker.ts`): BullMQ consumer, concurrency 1, processes prompts sequentially across 3 providers
- **API** (`src/api.ts`): Express server on :3333 for session uploads and health checks
- **Agent handler** (`src/agents/lib/agentHandler.ts`): Per-provider timeout (8 min) + retry (2 attempts), closes browser on failure
- **Navigation** (`src/lib/browser/navigateWithRetry.ts`): Retries page.goto on SSL/timeout/proxy errors (3 attempts, 5s delay)
- **Browser context** (`src/lib/browser/launchContext.ts`): Stealth plugin, proxy support, auth state from `/storage`
- **Page defaults**: `defaultTimeout(0)` (no limit), `defaultNavigationTimeout(120s)`

### Job Flow

1. Web app enqueues `UserPrompt[]` via `agent.run` tRPC mutation
2. Worker picks up job, runs all 3 providers sequentially
3. Each provider: launch browser → navigate → authenticate → warm up editor → type prompt → wait for response → extract sources
4. Results stored in ClickHouse (`prompt_responses`) and Redis (1h TTL for polling)
5. Web app polls `agent.status` every 3s until completed

### Databases

- **PostgreSQL**: Users, sessions, workspaces, organizations (Drizzle schema in `packages/db/src/schema/`)
- **ClickHouse**: `analytics.user_prompts`, `analytics.prompt_responses`, `analytics.prompt_analysis` (schema in `packages/db/clickhouse-init/schema.sql`)
- ClickHouse init scripts only run on first startup — use `docker exec -i clickhouse_db clickhouse-client < packages/db/clickhouse-init/schema.sql` to re-run

## Common Commands

```bash
# Development
pnpm dev:web              # Start web app with turbo
pnpm dev:agent            # Start agent in dev mode

# Build
pnpm build                # Build all packages via turbo

# Database
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Run PostgreSQL migrations
pnpm db:studio            # Open Drizzle Studio

# Agent
pnpm auth                 # Check auth status
pnpm --filter @onescope/agent login   # Interactive browser login (headed)

# Docker (production)
docker compose build agent-worker     # Rebuild agent worker
docker compose up -d                  # Start all services
docker compose down                   # Stop (DO NOT use -v, it deletes volumes)
```

## Deployment

- **Docker Compose** with 6 services: web, agent-api, agent-worker, redis, postgres, clickhouse
- Auth sessions stored in bind mount `./agent-data:/storage` (persists across rebuilds)
- Agent worker uses residential proxy (`PROXY_SERVER` env var, format: `http://host:port`)
- Web app behind nginx on VPS, ports 3000 (web) and 3333 (agent API) bound to 127.0.0.1

## Environment Variables

- `apps/agent/.env` — agent-specific (proxy, auth paths, Redis, API token)
- `.env` (root) — shared (database URLs, auth secrets, API keys)
- `DEBUG` env var (not `DEBUG_ENABLED`) controls debug logging in agent

## Code Conventions

- ESM imports with `.js` extensions in agent app (NodeNext module resolution)
- Shared types go in `packages/types/src/types/`
- Shared business logic goes in `packages/services/src/`
- Error handling: `safeHandler()` wrapper for tRPC mutations, `try-catch-finally` with browser cleanup in agent
- Logger levels: `logger.log()` for production output, `logger.debug()` for debug-only (gated by `DEBUG=true`)
- No tests currently — be careful with changes, verify manually
