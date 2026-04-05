# OneGlanse

OneGlanse tracks how your brand appears across real AI chat interfaces, stores
responses and citations, and turns them into visibility and source metrics.

This monorepo contains:

- `apps/web` - the main product app
- `apps/agent` - the Camoufox-based worker
- `apps/landing` - the marketing site
- `apps/docs` - the documentation site

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
- docs: [https://oneglanse.com/docs](https://oneglanse.com/docs)

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

- creates `.env` and `apps/agent/.env` if missing
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

That starts the shared providers flow at
[http://localhost:3000/providers](http://localhost:3000/providers) without
running the full app stack.

### 3. Self-Host It

```bash
pnpm install
pnpm self-host
```

This starts both self-hosted stacks:

- the main app stack from `docker-compose.yml`
- the always-on public stack from `docker-compose.public.yml`
- forces app mode to `self-hosted`

Default ports:

- landing: `http://<host>:3000`
- app: `http://<host>:3001`
- docs: `http://<host>:3002`
- auth upload API: `http://<host>:3333`

Persistent VPS state is stored under `/opt/oneglanse/storage` and mounted into
the containers as `/storage`.

### App-Only Redeploys

Routine product updates should use the default app stack:

```bash
docker compose up -d --build
```

Or:

```bash
pnpm self-host:app
```

Because `docker-compose.yml` is app-only, `docker compose down` no longer takes
down landing or docs.

### Public-Site Redeploys

Only redeploy landing/docs when you actually change them:

```bash
docker compose -f docker-compose.public.yml up -d --build
```

Or:

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

1. Open the app or run `pnpm auth`
2. Click a connect button
3. A local Camoufox sign-in browser opens
4. Sign in and close it when done
5. The UI shows a checkmark when that provider auth is saved

### VPS auth flow

The VPS never opens an interactive login browser.

Run this on your **local machine** instead:

```bash
pnpm auth -- --upload-url http://YOUR_VPS_HOST:3333/auth/sessions --upload-token YOUR_TOKEN
```

That flow captures auth locally, stores it locally, uploads it to the VPS, and
invalidates the matching VPS runtime profiles so the next run reseeds cleanly.

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
  - `APP_URL`
  - `API_BASE_URL`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `AGENT_AUTH_UPLOAD_TOKEN`
  - `PROXY_*` / `THORDATA_PROXY_API_URL` for VPS proxying
- `apps/agent/.env`
  - `CAMOUFOX_HEADLESS_MODE`
  - `CAMOUFOX_PYTHON_BIN`
  - `CAMOUFOX_PIP_SPEC`
  - `CAMOUFOX_BROWSER_CHANNEL`
  - `DEBUG_ENABLED`

Local bootstrap defaults are pinned to `cloverlabs-camoufox==0.5.5` and
`official/stable/135.0.1-beta.24`. Override those in `apps/agent/.env` only if
you intentionally want to test a different Camoufox package/browser pair.

Deployment mode is controlled by one variable:

- `ONEGLANSE_APP_MODE=cloud|self-hosted|local`

Behavior:

- `pnpm local` and `pnpm auth` force `local`
- `docker-compose.yml` forces `self-hosted`
- anything else defaults to `cloud`

Schedule is only available in `local` and `self-hosted` mode.

For VPS auth capture, prefer passing `--upload-url` and `--upload-token`
directly to `pnpm auth`.

## Useful Commands

- `pnpm local` - full local app + worker
- `pnpm auth` - shared local auth flow only
- `pnpm self-host` - start both the app and public VPS stacks
- `pnpm self-host:app` - rebuild only the app stack
- `pnpm self-host:public` - rebuild only the public stack
- `pnpm self-host:pull` - pull both stacks before an update
- `pnpm typecheck` - typecheck the monorepo
- `pnpm build` - build the monorepo

## Docs

For detailed local setup, VPS deployment, env reference, and proxy guidance,
open:

- the local docs app with `pnpm dev:docs`, or
- the self-hosted docs app at `http://<host>:3002`
