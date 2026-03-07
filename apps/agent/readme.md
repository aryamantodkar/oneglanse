# @oneglanse/agent

Playwright-launched Chromium + BullMQ worker responsible for executing provider prompt jobs and persisting results.

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
  - `PROXY_URL` or split proxy fields below
  - `PROXY_PROVIDER` (`generic`, `decodo`, `smartproxy`, `brightdata`, `oxylabs`, `thordata`, `lunaproxy`, `netnut`, `soax`, `scrapeops`, `proxyempire`, `iproyal`, `webshare`)
  - `PROXY_SCHEME` (optional with split fields; defaults to `http`)
  - `PROXY_HOST`
  - `PROXY_PORT`
  - `PROXY_USERNAME` (optional; requires `PROXY_PASSWORD`)
  - `PROXY_PASSWORD` (optional; requires `PROXY_USERNAME`)
  - Supported schemes: `http`, `https`, `socks4`, `socks5`
- Browser fingerprint alignment:
  - `BROWSER_LOCALE`
  - `BROWSER_TIMEZONE`
  - `BROWSER_ACCEPT_LANGUAGE`
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

Proxy examples:

```env
# Single URL form
PROXY_URL=http://user:pass@proxy.example.com:8080
PROXY_PROVIDER=generic

# Or split fields
PROXY_SCHEME=socks5
PROXY_HOST=proxy.example.com
PROXY_PORT=1080
PROXY_USERNAME=user
PROXY_PASSWORD=pass
```

Provider-aware rotation examples:

```env
# Decodo / Smartproxy:
# Use either a sticky port endpoint or a gate.decodo.com session username.
# For sticky-port endpoints, the agent picks one random documented sticky port
# per provider run and reuses it for that browser session.
PROXY_PROVIDER=decodo
PROXY_SCHEME=http
PROXY_HOST=us.decodo.com
PROXY_PORT=10001
PROXY_USERNAME=user-abc
PROXY_PASSWORD=pass-abc
# PROXY_URL=http://user-abc-session-old-sessionduration-30:pass-abc@gate.decodo.com:7000

# Bright Data:
# Bright Data session ids must stay alphanumeric; the agent rewrites only the
# session token.
PROXY_PROVIDER=brightdata
PROXY_URL=http://brd-customer-CUSTOMER-zone-ZONE-session-old:pass@brd.superproxy.io:33335

# Oxylabs:
# Start from a documented sticky seed port such as 10001/20001/30001/40001.
# The agent keeps one random sticky port for the lease. If your username
# already contains -sessid-, that token is replaced on each launch too.
PROXY_PROVIDER=oxylabs
PROXY_URL=http://customer-USERNAME:pass@us-pr.oxylabs.io:10001

# Thordata:
# sessid is replaced every launch with a 12-character token, existing sesstime
# is preserved.
PROXY_PROVIDER=thordata
PROXY_URL=http://td-customer-USERNAME-country-US-sessid-old-sesstime-10:pass@treyklah.na.thordata.net:9999

# LunaProxy:
# sessid is replaced every launch with a 12-character token, existing sesstime
# is preserved.
PROXY_PROVIDER=lunaproxy
PROXY_URL=http://user-USERNAME-region-us-sessid-old-sesstime-10:pass@rw.lunaproxy.com:12233

# NetNut:
# Start from the dashboard-generated base username. The agent appends/replaces sid.
PROXY_PROVIDER=netnut
PROXY_URL=http://USERNAME-res-us:pass@gw.netnut.net:5959

# SOAX:
PROXY_PROVIDER=soax
PROXY_URL=http://package-12345-country-us-sessionid-old-sessionlength-300:pass@proxy.soax.com:5000

# ScrapeOps:
PROXY_PROVIDER=scrapeops
PROXY_URL=http://scrapeops.sticky_session=7:API_KEY@residential-proxy.scrapeops.io:8181

# ProxyEmpire:
# Start from the dashboard-generated base username. The agent appends/replaces
# an 8-digit sid.
PROXY_PROVIDER=proxyempire
PROXY_URL=http://your-dashboard-username:pass@res.proxyempire.io:9000

# IPRoyal:
# Sticky session tokens live in the password.
PROXY_PROVIDER=iproyal
PROXY_URL=http://username:pass_country-US_session-old_lifetime-10m@geo.iproyal.com:12321

# Webshare:
# Passed through unchanged. Stickiness is selected on the provider side.
PROXY_PROVIDER=webshare
PROXY_URL=http://username:pass@p.webshare.io:80
```

When `PROXY_PROVIDER` is anything other than `generic`, the agent intentionally
skips warm-browser reuse and persistent browser profiles so each fresh launch
can negotiate a fresh upstream proxy session cleanly.

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
