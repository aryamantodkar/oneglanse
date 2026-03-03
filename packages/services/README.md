# @oneglanse/services

Business/service layer for OneGlanse.

This package is the domain boundary between app routers/components and raw data/storage/queue operations.

## Responsibilities

- Workspace lifecycle and membership operations.
- Prompt persistence and retrieval.
- Queue submission and Redis progress management.
- Response analysis orchestration.
- Scheduler integration (`pg_cron`) and immediate run submission helpers.

## Module Overview

- `src/workspace/*`: workspace CRUD, membership, schedule/provider updates.
- `src/prompt/*`: prompt storage, response storage, source/response fetch.
- `src/analysis/*`: analysis run, prompt analysis records, fetch APIs.
- `src/agent/*`: queue naming, queue access, Redis client, job-group submission.
- `src/llm/*`: ChatGPT client initialization.

## Public Exports

From `src/index.ts`:

- analysis APIs (`analysePromptsForWorkspace`, `fetchAnalysedPrompts`, etc.)
- prompt APIs (`storePromptsForWorkspace`, `storePromptResponses`, fetchers)
- workspace APIs (create/list/update/member/schedule/provider helpers)
- agent APIs (`submitAgentJobGroup`, `getProviderQueue`, `redis`, etc.)

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/services build` | Compile TypeScript |
| `pnpm --filter @oneglanse/services typecheck` | TypeScript checks |

## Environment Variables

Validated in `src/env.ts`:

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `API_BASE_URL`
- `INTERNAL_CRON_SECRET`
- `OPENAI_API_KEY`

## Usage Pattern

- `apps/web` routers should call this package for business operations.
- `apps/agent` worker should call this package for persistence and queue contracts.
- Avoid importing `@oneglanse/db` directly from UI/page layers when a service API exists.

## Example

```ts
import { submitAgentJobGroup, fetchAnalysedPrompts } from "@oneglanse/services";
```
