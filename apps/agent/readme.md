# @oneglanse/agent

Camoufox-backed browser worker + BullMQ worker responsible for executing provider prompt jobs and persisting results.

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

- Required runtime:
  - `ONEGLANSE_APP_MODE`
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD`
  - `DEBUG_ENABLED`
- App/runtime wiring:
  - `NODE_ENV`
  - `AGENT_AUTH_ROOT_DIR`
  - `AGENT_AUTH_UPLOAD_URL`
  - `AGENT_AUTH_UPLOAD_TOKEN`
- Proxy config:
  - `THORDATA_PROXY_API_URL`
  - `PROXY_SCHEME` (optional; defaults to `http`)
  - Supported schemes: `http`, `https`
- Browser/runtime config:
  - `CAMOUFOX_PYTHON_BIN` (optional)
  - `CAMOUFOX_HEADLESS_MODE` (`virtual`, `headful`, `headless`)
  - `CAMOUFOX_XVFB_DISPLAY`
  - `CAMOUFOX_XVFB_SCREEN`
  - `CAMOUFOX_GEOIP`
  - `CAMOUFOX_GEOIP_DB`
  - `CAMOUFOX_OS`
  - `CAMOUFOX_LOCALE`
  - `CAMOUFOX_FONTS`
  - `CAMOUFOX_ADDONS`
  - `CAMOUFOX_EXCLUDE_ADDONS`
  - `CAMOUFOX_WEBGL_CONFIG`
  - `CAMOUFOX_BROWSER`
  - `CAMOUFOX_FF_VERSION`
  - `CAMOUFOX_CONFIG_JSON`
  - `CAMOUFOX_FINGERPRINT_JSON`
  - `CAMOUFOX_FINGERPRINT_PRESET`
  - `CAMOUFOX_FIREFOX_USER_PREFS_JSON`
  - `CAMOUFOX_ENV_JSON`
  - `CAMOUFOX_ARGS`
  - `CAMOUFOX_EXECUTABLE_PATH`
  - `CAMOUFOX_MAIN_WORLD_EVAL`
  - `CAMOUFOX_ENABLE_CACHE`
  - `CAMOUFOX_BLOCK_IMAGES`
  - `CAMOUFOX_BLOCK_WEBRTC`
  - `CAMOUFOX_BLOCK_WEBGL`
  - `CAMOUFOX_DISABLE_COOP`
  - `CAMOUFOX_CUSTOM_FONTS_ONLY`
  - `CAMOUFOX_I_KNOW_WHAT_IM_DOING`
  - `CAMOUFOX_DEBUG`
  - `CAMOUFOX_EXTRA_LAUNCH_JSON`

Timeouts, retries, submission cadence, response minimums, and similar tuning are hardcoded in the agent and are no longer part of the env surface.

## Local Development

1. Ensure the root env file exists:

```bash
cp .env.example .env
```

Proxy examples:

```env
PROXY_SCHEME=http
THORDATA_PROXY_API_URL=https://get-ip.thordata.net/api?td-customer=YOUR_CUSTOMER_ID&sesstype=1&number=5&country=US
```

The agent requests fresh ThorData residential proxy candidates before each
browser launch, leases one proxy for that session, and avoids giving the same
leased proxy to two workers at the same time.

2. Start the local stack from the repo root:

```bash
pnpm local
```

`pnpm local` installs dependencies if needed before starting the app and agent.

Camoufox runtime example:

```env
CAMOUFOX_HEADLESS_MODE=virtual
CAMOUFOX_XVFB_DISPLAY=:99
CAMOUFOX_XVFB_SCREEN=1920x1080x24
CAMOUFOX_HUMANIZE=true
CAMOUFOX_HUMANIZE_MAX_TIME_S=1.5
CAMOUFOX_GEOIP=true
CAMOUFOX_OS=["windows","macos","linux"]
CAMOUFOX_LOCALE=["en-US","en"]
CAMOUFOX_EXTRA_LAUNCH_JSON={"ignore_default_args":["--enable-automation"]}
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
- Each provider worker runs with concurrency `1`.
