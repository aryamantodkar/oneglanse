# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OneGlanse is a Turborepo monorepo for AI-powered analytics and monitoring that combines browser automation with multi-provider LLM support (OpenAI, Anthropic, Perplexity).

## Prerequisites

- Node.js >= 20
- pnpm 10.16.0+
- Docker and Docker Compose (for deployment)

## Custom Commands

This repository has custom Claude Code commands in `.claude/commands/` for VPS operations:

- `commit-and-push` - Analyze changes, create detailed commit message, and push to GitHub
- `deploy` - Deploy to VPS after GitHub Actions builds images
- `logs` - View Docker service logs
- `restart` - Restart Docker services
- `status` - Check service health and status

Simply invoke these by name when working with Claude Code.

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Run specific apps
pnpm dev:web      # Next.js web application only
pnpm dev:agent    # Browser automation agent only

# Type checking across all packages
pnpm typecheck

# Linting
pnpm lint

# Clean all build artifacts and node_modules
pnpm clean
```

### Database Operations

```bash
# Generate new migrations (from schema changes)
pnpm db:generate

# Run migrations against the database
pnpm db:migrate

# Push schema changes directly (development only)
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

### Agent Operations

```bash
# Authenticate the agent with LLM providers
pnpm auth

# Start the agent (runs both API and Worker)
pnpm start:agent

# Start agent API only (port 3333)
pnpm start:api

# Start agent worker only (processes jobs from BullMQ)
pnpm start:worker
```

### Building

```bash
# Build all packages and apps
pnpm build

# Build specific package
pnpm --filter @oneglanse/web build
pnpm --filter @oneglanse/agent build
pnpm --filter @oneglanse/db build
```

### Docker Deployment

```bash
# Deploy to VPS (recommended)
./scripts/deploy-vps.sh

# Manual deployment
docker compose pull && docker compose down && docker compose up -d

# View logs
docker compose logs -f
docker compose logs -f web
docker compose logs -f agent-worker
docker compose logs -f agent-api

# Run migrations in Docker
docker compose run --rm migrate
```

## Architecture

### Monorepo Structure

```
oneglanse/
├── apps/
│   ├── web/          # Next.js 15 application with tRPC API
│   └── agent/        # Browser automation agent (Playwright)
└── packages/
    ├── db/           # Database schemas and connections (Drizzle ORM)
    ├── types/        # Shared TypeScript types
    ├── services/     # Shared business logic (LLM, agent, workspace)
    ├── errors/       # Error handling and logging
    ├── ui/           # Shared React components (Radix UI + Tailwind)
    └── utils/        # Shared utility functions
```

### Web Application (`apps/web`)

**Tech Stack:**
- Next.js 15 with App Router
- tRPC for type-safe API
- better-auth for authentication
- Drizzle ORM with PostgreSQL (relational) + ClickHouse (analytics)
- Tailwind CSS 4
- React 19

**Key Directories:**
- `src/app/`: Next.js App Router pages and layouts
  - `(auth)/`: Protected routes (dashboard, workspace, settings, schedule)
  - `api/`: API routes (tRPC, auth endpoints)
  - `login/`, `signup/`: Authentication pages
- `src/server/api/`: tRPC setup and routers
  - `routers/`: tRPC routers (workspace, prompt, location, analysis, agent, internal)
  - `middleware/`: tRPC middleware
  - `procedures.ts`: Reusable procedures (protected, public)
  - `root.ts`: Main router composition
- `src/trpc/`: Client-side tRPC setup
- `src/lib/`: Client utilities
- `src/components/`: React components

**tRPC Routers:**
- `workspace`: Workspace CRUD and management
- `prompt`: User prompt submission and retrieval
- `location`: Location/region data
- `analysis`: Analytics and insights
- `agent`: Agent job submission and status
- `internal`: Internal API operations

### Agent Application (`apps/agent`)

**Architecture:**
The agent is split into two separate processes:

1. **API Server** (`src/api.ts`, port 3333):
   - HTTP API for uploading browser sessions
   - Health checks
   - Authentication endpoint

2. **Worker** (`src/worker.ts`):
   - BullMQ worker that processes prompt jobs
   - Manages browser automation with Playwright
   - Coordinates jobs across three LLM providers

**Key Directories:**
- `src/agents/`: LLM provider-specific agents
  - `openai/`: OpenAI agent with browser automation
  - `anthropic/`: Anthropic Claude agent
  - `perplexity/`: Perplexity agent
  - `lib/`: Shared agent utilities (browser handling, session management)
- `src/auth/`: Authentication state management for providers
- `src/lib/`: Shared utilities

**Job Queue Flow:**
1. Web app submits job via tRPC → BullMQ queue
2. Worker picks up job from Redis queue
3. Worker spawns browser using Playwright
4. Agent executes prompts for each provider (OpenAI, Anthropic, Perplexity)
5. Results stored in database
6. Analysis runs in background after all prompts complete

### Database Package (`packages/db`)

**Setup:**
- Drizzle ORM for type-safe database access
- PostgreSQL for relational data (users, workspaces, prompts)
- ClickHouse for analytics data (events, metrics)

**Schema Location:** `packages/db/src/schema/`
- `auth.ts`: User authentication tables
- `workspace.ts`: Workspace and related tables
- Additional schema files as needed

**Connection:**
- `src/pg.ts`: PostgreSQL connection pool
- `src/index.ts`: Exports db client and schema

### Services Package (`packages/services`)

Centralized business logic shared between web and agent:

- `agent/`: Job queue setup, Redis connection
- `analysis/`: Analytics services
- `llm/`: LLM provider integrations
- `prompt/`: Prompt processing logic
- `workspace/`: Workspace operations

### Types Package (`packages/types`)

Shared TypeScript types for:
- User prompts and responses
- Provider types (OpenAI, Anthropic, Perplexity)
- Agent job payloads
- Database entities

## Key Patterns

### Browser Automation

The agent uses Playwright with stealth plugins to avoid detection. Browser sessions are authenticated once and state is persisted in `/storage/<provider>/state.json` files.

### Job Processing

Jobs are submitted to BullMQ queues by provider. Each provider has its own queue:
- `openai-prompts`
- `anthropic-prompts`
- `perplexity-prompts`

Workers process jobs in parallel per provider.

### Authentication

- **Web App**: Uses better-auth with session-based authentication
- **Agent**: Stores authenticated browser sessions per LLM provider
- **API**: Token-based auth for agent API endpoints

### Database Migrations

1. Modify schema files in `packages/db/src/schema/`
2. Run `pnpm db:generate` to create migration files
3. Run `pnpm db:migrate` to apply migrations
4. In production, migrations run via Docker service before web app starts

### Environment Variables

- `.env`: Main config (database URLs, auth secrets, API keys)
- `apps/agent/.env`: Agent-specific config (proxy settings, Redis, auth paths)

## Testing Patterns

### Running Tests

Tests use Playwright Test framework:
```bash
# Run all tests
pnpm --filter @oneglanse/agent test

# Run specific test file
pnpm --filter @oneglanse/agent test src/__tests__/agent.spec.ts
```

## Deployment

### Docker Services

- `web`: Next.js application (port 3000)
- `agent-api`: Agent HTTP API (port 3333)
- `agent-worker`: Background job processor
- `db`: PostgreSQL database (port 5432)
- `clickhouse`: ClickHouse analytics database (ports 8123, 9000)
- `redis`: Redis for BullMQ (port 6379)
- `migrate`: One-shot migration service

### CI/CD

GitHub Actions builds and pushes Docker images to GitHub Container Registry on push to `feat/no-auth-providers` branch:
- `ghcr.io/aryamantodkar/oneglanse-web:latest`
- `ghcr.io/aryamantodkar/oneglanse-agent:latest`
- `ghcr.io/aryamantodkar/oneglanse-postgres:latest`

## Workspace Dependencies

Packages use `workspace:*` protocol to reference each other. The dependency graph is:
- `apps/web` → depends on all packages
- `apps/agent` → depends on types, services, errors, utils
- `packages/services` → depends on db, types, errors, utils
- `packages/db` → standalone
- `packages/types` → standalone
- `packages/errors` → standalone
- `packages/ui` → depends on utils
- `packages/utils` → standalone

When modifying a package, run `pnpm build` from the root to rebuild dependencies in the correct order (handled by Turborepo).

## Important Notes

- All packages use ES modules (`"type": "module"`)
- Shared packages must be built before use in apps (Turborepo handles this automatically)
- The agent requires authenticated browser sessions - run `pnpm auth` or `pnpm login` before first use
- Database schema changes require migration generation and execution
- BullMQ requires Redis to be running
- The web app expects both PostgreSQL and ClickHouse to be available
