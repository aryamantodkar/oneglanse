# OneGlanse

OneGlanse tracks how your brand appears across real AI chat interfaces, stores
responses and citations, and turns them into visibility and source metrics.

This monorepo contains:

- `apps/web` - the main product app
- `apps/agent` - the Camoufox-based worker
- `apps/landing` - the marketing site
- `docs` - the Mintlify documentation source

## Requirements

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

## Quick Start

OneGlanse supports three setup paths depending on how you want to run it.

### 1. Use The Cloud App

Open the hosted app directly:

- app: [https://app.oneglanse.com](https://app.oneglanse.com)
- landing: [https://oneglanse.com](https://oneglanse.com)
- docs: [https://docs.oneglanse.com/](https://docs.oneglanse.com/)

Recommended flow:

1. Sign in
2. Create or pick a workspace
3. Connect providers on `/providers`
4. Add prompts your target audience would actually search for
5. Review dashboard, prompt responses, and sources once runs complete

### 2. Run It Locally

```bash
pnpm install
pnpm local
```

This:

- creates `.env` if missing
- bootstraps a pinned local Camoufox package/browser pair automatically on first run
- starts Postgres, ClickHouse, and Redis
- runs database migrations
- starts the web app and the agent locally
- opens the app at [http://localhost:3000](http://localhost:3000)
- forces app mode to `local`

If provider auth is missing, the app routes you to `/providers`.

Local-first auth only:

```bash
pnpm auth
```

That starts the local app + agent auth stack and opens
[http://localhost:3000/providers](http://localhost:3000/providers) so you can
connect providers from the web UI.

### 3. Self-Host It

```bash
pnpm install
pnpm self-host
```

This starts both self-host stacks:

- the main app stack from `docker-compose.yml`
- the always-on public stack from `docker-compose.public.yml`
- forces app mode to `self-host`
- tries to pull the latest published images first
- automatically falls back to a local Docker build if pulling is unavailable

Default ports:

- landing: `http://<host>:3000`
- app: `http://<host>:3001`
- auth upload API: `http://<host>:3333`

Persistent VPS state defaults to `/opt/oneglanse/storage` and is mounted into
the containers as `/storage`. Override it with `ONEGLANSE_STORAGE_ROOT` if your
host should store data elsewhere.

By default, self-host compose pulls the published images from:

- `ghcr.io/aryamantodkar/oneglanse-web:latest`
- `ghcr.io/aryamantodkar/oneglanse-agent:latest`
- `ghcr.io/aryamantodkar/oneglanse-postgres:latest`
- `ghcr.io/aryamantodkar/oneglanse-landing:latest`

If those images are unavailable on a target machine, `pnpm self-host` falls
back automatically to `docker compose up -d --build`, so a clean clone on a VPS
can still start with one command and without manual Docker login steps.

If you want to deploy prebuilt images instead, set these env vars before
running the compose helpers:

- `ONEGLANSE_WEB_IMAGE`
- `ONEGLANSE_AGENT_IMAGE`
- `ONEGLANSE_POSTGRES_IMAGE`
- `ONEGLANSE_LANDING_IMAGE`

If you want to build from source instead of pulling published images, use:

- `pnpm self-host:build`
- `pnpm self-host:app:build`
- `pnpm self-host:public:build`

### App-Only Redeploys

Routine product updates should use the default app stack:

```bash
pnpm self-host:app
```

Because `docker-compose.yml` is app-only, `docker compose down` no longer takes
down landing.

### Public-Site Redeploys

Only redeploy the public landing surface when you actually change it:

```bash
pnpm self-host:public
```

### Maintenance Page

The app port is now fronted by an always-on gateway in the public stack. If the
web app is restarting or temporarily unavailable, that gateway serves a short
"Be right back in a few seconds" page instead of a connection error.

## Provider Auth

Provider auth uses one canonical route:

- `/providers`

Supported runtime providers:

- ChatGPT
- Perplexity
- Gemini
- Claude
- AI Overview

Auth groups:

- ChatGPT
- Perplexity
- Google
- Claude

Gemini and Google Search auth are stored separately.

### Local auth flow

1. Run `pnpm local` or `pnpm auth`
2. Click a connect button
3. A local Camoufox sign-in browser opens
4. Sign in and close it when done
5. The UI shows a checkmark when that provider auth is saved

### VPS auth flow

The VPS never opens an interactive login browser.

Set these in your local `.env`:

```bash
ONEGLANSE_VPS_IP=YOUR_VPS_IP
AGENT_AUTH_UPLOAD_TOKEN=YOUR_TOKEN
```

Then run this on your **local machine**:

```bash
pnpm upload:vps
```

That uploads any existing local auth sessions directly to the VPS without
opening the auth app again.

If you do not have local sessions yet, use:

```bash
pnpm auth
```

If `ONEGLANSE_VPS_IP` and `AGENT_AUTH_UPLOAD_TOKEN` are already set, the local
`/providers` flow uploads freshly saved sessions to the VPS automatically.

## Auth and Runtime State

OneGlanse uses both:

- one portable `storageState` bundle per auth group
- one persistent Camoufox runtime profile per runtime provider

The auth bundle is the portable source of truth. Runtime profiles are the
machine-local execution state.

Runtime behavior:

- if a runtime profile is missing, it is seeded from the auth bundle
- if the auth bundle changes, the runtime profile is reseeded
- otherwise the existing persistent profile is reused directly

## Environment Variables

Most variables already have good defaults. In most cases you only need to care
about:

- `.env`
  - `OPENAI_API_KEY`
  - `BETTER_AUTH_SECRET`
  - `INTERNAL_CRON_SECRET`
  - `APP_URL`
  - `API_BASE_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `ONEGLANSE_VPS_IP`
  - `AGENT_AUTH_UPLOAD_TOKEN`
  - `PROXY_*` / `THORDATA_PROXY_API_URL` for VPS proxying
- Optional agent/runtime vars in `.env`
  - `CAMOUFOX_HEADLESS_MODE`
  - `CAMOUFOX_PYTHON_BIN`
  - `CAMOUFOX_PIP_SPEC`
  - `CAMOUFOX_BROWSER_CHANNEL`
  - `DEBUG_ENABLED`

Local bootstrap defaults are pinned to `cloverlabs-camoufox==0.5.5` and
`official/stable/135.0.1-beta.24`. Override those in `.env` only if
you intentionally want to test a different Camoufox package/browser pair.

Deployment mode is controlled by one variable:

- `ONEGLANSE_APP_MODE=cloud|self-host|local`

Behavior:

- `pnpm local` and `pnpm auth` force `local`
- `docker-compose.yml` forces `self-host`
- anything else defaults to `cloud`

Recurring schedule is only available in `self-host` mode. `local` mode
supports manual prompt runs only.

For VPS auth upload, prefer setting `ONEGLANSE_VPS_IP` and
`AGENT_AUTH_UPLOAD_TOKEN` in `.env`, then running `pnpm upload:vps`.

## Useful Commands

- `pnpm local` - full local app + worker
- `pnpm auth` - start the local app + agent stack and open `/providers`
- `pnpm upload:vps` - upload existing local auth sessions to the configured VPS
- `pnpm self-host` - start both the app and public VPS stacks
- `pnpm self-host:app` - pull and refresh only the app stack
- `pnpm self-host:public` - pull and refresh only the public stack
- `pnpm self-host:build` - build and start both stacks from source
- `pnpm self-host:app:build` - build only the app stack from source
- `pnpm self-host:public:build` - build only the public stack from source
- `pnpm self-host:pull` - pull configured prebuilt images before an update
- `pnpm typecheck` - typecheck the monorepo
- `pnpm build` - build the monorepo

## Docs

Mintlify reads the root `docs/` directory directly. That folder is now the
single docs source for deploys and external documentation hosting.
