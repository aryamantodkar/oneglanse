# oneglanse

A monorepo for AI-powered analytics and monitoring.

## Structure

```
oneglanse/
├── apps/
│   ├── web/          # Next.js web application
│   └── agent/        # Browser automation agent
├── packages/
│   ├── db/           # Database schema and connection (Drizzle ORM)
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared React UI components
│   └── utils/        # Shared utilities
├── package.json      # Root package.json
├── pnpm-workspace.yaml
├── turbo.json        # Turborepo configuration
└── tsconfig.json     # Base TypeScript config
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 10.16.0+

### Installation

```bash
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run only the web app
pnpm dev:web

# Run only the agent
pnpm dev:agent
```

### Database

```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Push schema changes
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

### Build

```bash
pnpm build
```

### Type Checking

```bash
pnpm typecheck
```

## Packages

### @oneglanse/types

Shared TypeScript type definitions used across all apps.

```typescript
import type { UserPrompt, PromptResponse } from "@oneglanse/types";
```

### @oneglanse/db

Database schema, connection utilities, and entity types.

```typescript
import { db, schema } from "@oneglanse/db";
import type { User, Workspace } from "@oneglanse/db";
```

### @oneglanse/ui

Shared React UI components built with Radix UI and Tailwind CSS.

```typescript
import { Button, Card, Dialog } from "@oneglanse/ui";
```

### @oneglanse/utils

Shared utility functions.

```typescript
import { cn } from "@oneglanse/utils";
```

## Apps

### @oneglanse/web

Next.js 15 web application with:
- tRPC API
- better-auth authentication
- Drizzle ORM with PostgreSQL
- Tailwind CSS 4

### @oneglanse/agent

Browser automation agent with:
- Playwright for browser control
- BullMQ job queue
- Multi-provider LLM support (OpenAI, Anthropic, Perplexity)

Add vps to oauth