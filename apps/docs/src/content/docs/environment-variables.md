# Environment Variables

This list is based on your current `.env` and `apps/agent/.env` files.
Only required runtime keys are documented here.

## Root `.env` (required)

```env
DATABASE_URL=
CLICKHOUSE_URL=
CLICKHOUSE_DB=
CLICKHOUSE_USER=
CLICKHOUSE_PASSWORD=
APP_URL=
API_BASE_URL=
NEXT_PUBLIC_API_URL=
BETTER_AUTH_SECRET=
INTERNAL_CRON_SECRET=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## `apps/agent/.env` (required)

```env
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
API_AUTH_TOKEN=
PROXY_SOURCE_MODE=
# use one based on proxy mode
PROXY_API_URL=
PROXY_MANUAL_FILE=
```

## Rules

- Keep all secret values server-side.
- Keep Redis values aligned across root and agent env files.

## Landing and Docs env files

- `apps/landing` does not require a dedicated env file for current setup.
- `apps/docs` does not require a dedicated env file for current setup.
- Optional placeholders exist at:
  - `apps/landing/.env.example`
  - `apps/docs/.env.example`
- Domain routing for both is handled at Nginx and container port level.
