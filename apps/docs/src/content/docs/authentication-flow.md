# Authentication Flow

## User auth

- `apps/web` uses Better Auth for user sessions.
- Organization/workspace membership gates access.

## Internal auth

- Internal scheduled run endpoint uses `INTERNAL_CRON_SECRET`.
- Agent session upload/auth endpoints use `API_AUTH_TOKEN`.

## Provider auth

- Agent executes prompts using stored provider auth states.
- Worker jobs are isolated by provider queue.
