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
# Generic proxy
PROXY_PROVIDER=generic
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
# Recommended browser scheme from Decodo browser/tool docs: HTTP.
PROXY_PROVIDER=decodo
PROXY_SCHEME=http
PROXY_HOST=us.decodo.com
PROXY_PORT=10001
PROXY_USERNAME=user-abc
PROXY_PASSWORD=pass-abc
# Alternative gate.decodo.com session form:
# PROXY_SCHEME=http
# PROXY_HOST=gate.decodo.com
# PROXY_PORT=7000
# PROXY_USERNAME=user-abc-session-old-sessionduration-30
# PROXY_PASSWORD=pass-abc

# Bright Data:
# Bright Data session ids must stay alphanumeric; the agent rewrites only the
# session token.
# Recommended browser scheme from Bright Data integration docs: HTTP.
PROXY_PROVIDER=brightdata
PROXY_SCHEME=http
PROXY_HOST=brd.superproxy.io
PROXY_PORT=33335
PROXY_USERNAME=brd-customer-CUSTOMER-zone-ZONE-session-old
PROXY_PASSWORD=pass

# Oxylabs:
# Start from a documented sticky seed port such as 10001/20001/30001/40001.
# The agent keeps one random sticky port for the lease. If your username
# already contains -sessid-, that token is replaced on each launch too.
# Recommended browser scheme from Oxylabs browser integration docs: HTTP.
PROXY_PROVIDER=oxylabs
PROXY_SCHEME=http
PROXY_HOST=us-pr.oxylabs.io
PROXY_PORT=10001
PROXY_USERNAME=customer-USERNAME
PROXY_PASSWORD=pass

# Thordata:
# sessid is replaced every launch with a 12-character token, existing sesstime
# is preserved.
# If your dashboard gives you a dedicated host, keep that host as-is.
# Recommended scheme from current Thordata residential docs examples: HTTPS.
PROXY_PROVIDER=thordata
PROXY_SCHEME=https
PROXY_HOST=t.pr.thordata.net
PROXY_PORT=9999
PROXY_USERNAME=td-customer-USERNAME-country-US-sessid-old-sesstime-30
PROXY_PASSWORD=pass

# LunaProxy:
# sessid is replaced every launch with a 12-character token, existing sesstime
# is preserved.
# If your dashboard gives you a dedicated host, keep that host as-is.
# Recommended browser/tool scheme from LunaProxy guides: HTTP.
PROXY_PROVIDER=lunaproxy
PROXY_SCHEME=http
PROXY_HOST=rw.lunaproxy.com
PROXY_PORT=12233
PROXY_USERNAME=user-USERNAME-region-us-sessid-old-sesstime-10
PROXY_PASSWORD=pass

# NetNut:
# Start from the dashboard-generated base username. The agent appends/replaces sid.
# Recommended default from NetNut docs: HTTP.
PROXY_PROVIDER=netnut
PROXY_SCHEME=http
PROXY_HOST=gw.netnut.net
PROXY_PORT=5959
PROXY_USERNAME=USERNAME-res-us
PROXY_PASSWORD=pass

# SOAX:
# Recommended browser/web automation scheme from SOAX docs: HTTP.
PROXY_PROVIDER=soax
PROXY_SCHEME=http
PROXY_HOST=proxy.soax.com
PROXY_PORT=5000
PROXY_USERNAME=package-12345-country-us-sessionid-old-sessionlength-300
PROXY_PASSWORD=pass

# ScrapeOps:
# Recommended scheme from ScrapeOps proxy examples: HTTP.
PROXY_PROVIDER=scrapeops
PROXY_SCHEME=http
PROXY_HOST=residential-proxy.scrapeops.io
PROXY_PORT=8181
PROXY_USERNAME=scrapeops.sticky_session=7
PROXY_PASSWORD=API_KEY

# ProxyEmpire:
# Start from the dashboard-generated base username. The agent appends/replaces
# an 8-digit sid.
# Recommended browser/web automation scheme: HTTP.
PROXY_PROVIDER=proxyempire
PROXY_SCHEME=http
PROXY_HOST=res.proxyempire.io
PROXY_PORT=9000
PROXY_USERNAME=your-dashboard-username
PROXY_PASSWORD=pass

# IPRoyal:
# Sticky session tokens live in the password.
# Recommended browser/web automation scheme from IPRoyal examples: HTTP.
PROXY_PROVIDER=iproyal
PROXY_SCHEME=http
PROXY_HOST=geo.iproyal.com
PROXY_PORT=12321
PROXY_USERNAME=username
PROXY_PASSWORD=pass_country-US_session-old_lifetime-10m

# Webshare:
# Passed through unchanged. Stickiness is selected on the provider side.
# Recommended browser/web automation scheme: HTTP.
PROXY_PROVIDER=webshare
PROXY_SCHEME=http
PROXY_HOST=p.webshare.io
PROXY_PORT=80
PROXY_USERNAME=username
PROXY_PASSWORD=pass
```

Provider-specific sticky-session handling rewrites only the documented session
token for that provider. The base host, port, username, and password should
come directly from your provider dashboard.

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
