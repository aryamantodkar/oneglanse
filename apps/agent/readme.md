# @oneglanse/agent

Playwright + BullMQ worker responsible for executing provider prompt jobs and persisting results.

## Responsibilities

- Consume provider-specific queue jobs from Redis/BullMQ.
- Launch browser contexts, submit prompts, and extract responses/sources.
- Persist prompt responses through `@oneglanse/services`.
- Trigger analysis pipeline after successful response writes.
- Manage graceful shutdown of workers, warm browser pool, and Redis connections.

## Entry Points

- `src/index.ts`: process lifecycle and graceful shutdown orchestration.
- `src/worker.ts`: creates one BullMQ worker per provider.
- `src/worker/jobHandler.ts`: provider job execution path.
- `src/worker/analysis.ts`: post-response analysis trigger.

## Key Internal Modules

- `src/core/providers/*`: provider adapters/configs.
- `src/core/steps/*`: shared prompt execution steps.
- `src/core/prompt-runner/*`: orchestration and retry behavior.
- `src/lib/browser/*`: browser launch/navigation/warm pool/proxy handling.
- `src/lib/input/*`: editor detection, completion waits, and extraction helpers.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm --filter @oneglanse/agent dev` | Run worker entry in TS mode |
| `pnpm --filter @oneglanse/agent build` | Compile TS to `dist` |
| `pnpm --filter @oneglanse/agent start:worker` | Run compiled worker |
| `pnpm --filter @oneglanse/agent typecheck` | Run TypeScript checks |

## Environment Variables

Defined in `src/env.ts` (Zod validated):

- Core runtime:
  - `NODE_ENV`
  - `DEBUG_ENABLED`
  - `AGENT_WORKER_CONCURRENCY`
- Redis:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD`
- Timeouts/retries:
  - `STEP_EXECUTION_TIMEOUT_MS`
  - `PAGE_DEFAULT_TIMEOUT_MS`
  - `PAGE_DEFAULT_NAVIGATION_TIMEOUT_MS`
  - `MAX_PROMPT_RETRIES_PER_IP`
  - `PROMPT_RETRY_DELAY_MS`
  - `MAX_PROMPT_RETRY_DELAY_MS`
  - `MAX_EXTRACTION_RETRIES`
  - `EXTRACTION_RETRY_DELAY_MS`
  - `MAX_EXTRACTION_RETRY_DELAY_MS`
- Proxy system:
  - `PROXY`
  - `PROXY_USERNAME`
  - `PROXY_PASSWORD`
  - `PROXY` supports `host:port`, `http://host:port`, `https://host:port`, `socks5://host:port`.
  - Session-aware usernames are auto-rotated per launch (supports `sessid-*`, `session-*`, `session_id=*`, `{{SESSID}}`, `$SESSID`).
- Provider tuning:
  - `MIN_RESPONSE_CHARS`
  - `PROVIDER_HOOK_TIMEOUT_MS`
  - `AI_OVERVIEW_WAIT_TIMEOUT_MS`
  - `SUBMIT_METHOD_TIMEOUT_MS`
  - `SUBMISSION_PHASE_TIMEOUT_MS`

## Local Development

1. Install deps:

```bash
pnpm install
```

2. Ensure env files exist:

```bash
cp apps/agent/.env.example apps/agent/.env
```

3. Start Redis and required dependencies.

4. Run worker:

```bash
pnpm --filter @oneglanse/agent dev
```

## Queue Model

- Queue name per provider comes from `@oneglanse/services` `getQueueName(provider)`.
- Jobs are submitted by `submitAgentJobGroup` in services.
- Worker status/progress is written to Redis key: `job:{jobGroupId}:result`.

## Dependencies

This app depends on:
- `@oneglanse/services` for persistence/queue contracts
- `@oneglanse/types` for provider/payload contracts
- `@oneglanse/utils` for logging and shared helpers
- `@oneglanse/errors` for typed error behavior

## Operational Notes

- Worker startup waits for Redis readiness before creating workers.
- Graceful shutdown closes warm browser resources before Redis disconnect.
- Worker concurrency defaults to `1` unless overridden via env.
