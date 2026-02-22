# Dependency Audit

## Monorepo-Wide Version Drift
- `@anthropic-ai/sdk`: `apps/web` `^0.63.0` vs `packages/services` `^0.63.1`.
- `openai`: `apps/web` `^5.22.0` vs `packages/services` `^5.23.2`.
- `better-auth`: `apps/web` `^1.3.9` vs `packages/services` `^1.4.17`.
- `bullmq`: `apps/agent` `^5.66.4` vs `packages/services` `^5.67.0`.
- `ioredis`: `apps/agent` `^5.9.1` vs `packages/services` `^5.9.2`.
- `pg`: `apps/web` `^8.17.2` vs `packages/db` `^8.16.3`.
- `@types/node`: `apps/web` `^20.14.10` vs `apps/agent` `^25.0.3` vs packages `^25.0.10`.

## Unused/Questionable Dependencies by Workspace

### apps/web
- High-confidence unused in source imports:
  - `axios`
  - `node-fetch`
  - `openai`
  - `@anthropic-ai/sdk`
  - `@perplexity-ai/perplexity_ai`
  - `@ai-sdk/anthropic`
  - `@ai-sdk/openai`
  - `@ai-sdk/react`
  - `cheerio`
  - `country-state-city`
  - `cron-parser`
  - `cronstrue`
  - `date-fns-tz`
  - `uuid`
- Likely wrong location:
  - `pg`, `redis` should live in server/service packages, not UI app package unless directly imported (not found).
- Fix:
  - remove unused packages and reinstall only what imports require.
  - move data/infra libs to `packages/services` or `packages/db` only.

### apps/agent
- High-confidence unused in source imports:
  - `express`
  - `tar`
  - `ioredis` (Redis client is consumed via `@onescope/services`).
  - `@playwright/test` (no tests currently).
  - `@types/express` (express not used).
- Fix:
  - remove unused runtime deps now.
  - re-add `@playwright/test` only when E2E tests are committed.

### packages/services
- High-confidence unused in source imports:
  - `@anthropic-ai/sdk`
  - `@perplexity-ai/perplexity_ai`
  - `better-auth`
- Fix:
  - remove now or move to the package that actually imports them.

### packages/ui
- `react-dom` is in `devDependencies` and `peerDependencies`.
- Current setup is acceptable but should be intentional/documented to avoid duplicate peer/runtime confusion.

### packages/db
- `drizzle-kit` is runtime `dependencies`; this is a build/dev tool.
- Fix:
  - move `drizzle-kit` to `devDependencies` in `packages/db`.
  - remove duplicate drizzle scripts/dependency from `apps/web`.

## Dependency Type Misclassification
- `apps/web` contains infra-heavy libs likely not required for app runtime.
- `packages/db` includes `drizzle-kit` in production dependencies.
- `apps/agent` includes unused server framework dependency (`express`) while using native `http` server.

## Tree-Shaking and Bundle Risk
- UI app carries unnecessary heavy SDKs in package manifest, increasing install/cold-start overhead and dependency attack surface.
- `apps/web` should not own provider SDKs unless used in route handlers inside that app.

## Standardization Opportunities
- Logger: standardize one logger package and remove direct `console.log` usage.
- Schema validation: standardize on zod for all external inputs.
- HTTP client: standardize on native `fetch` in Node 20+ unless a specific feature requires another client.
- Queue/Redis ownership: keep queue and redis clients in one package (`@onescope/services`) and remove duplicates.

## 1–2 Day Concrete Dependency Cleanup
- Step 1: remove high-confidence unused deps from `apps/web`, `apps/agent`, `packages/services`.
- Step 2: align shared versions using workspace constraints.
- Step 3: move build-only tools (`drizzle-kit`) to dev dependencies.
- Step 4: run typecheck/build and lockfile refresh.

## 🔥 Critical — Must Fix Before Open Source
- Remove unused high-risk SDK dependencies from `apps/web` and `apps/agent`.
- Resolve version drift for core auth/queue/LLM deps.
- Move tool-only dependencies out of runtime dependency sets.

## ⚡ High Priority — Fix This Week
- Add dependency linting in CI (`depcheck`/`knip`) with an allowlist.
- Add workspace-wide version policy for shared libraries.
- Reduce infra libs in app package manifests.

## 🟡 Medium Priority — Improve Soon
- Add periodic dependency update bot with grouped PR strategy.
- Add lockfile policy and review checklist for new dependencies.

## 💤 Later Improvements
- Add SBOM generation in CI.
- Add provenance/signature policy for release artifacts.
