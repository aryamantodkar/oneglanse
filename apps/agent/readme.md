# Onescope Agent

Playwright-based worker + API that runs authenticated browser sessions for multiple LLM providers, executes prompt jobs from Redis/BullMQ, and stores responses/sources.

## What This App Does

- Runs an HTTP API for session upload and health checks.
- Runs a BullMQ worker that processes provider jobs.
- Launches isolated browser contexts with stored auth state.
- Submits prompts, waits for generation, extracts markdown + sources.
- Uses rotating proxies with cooldown/scoring and retry policies.

## Architecture

```text
src/index.ts
  ├─ src/api.ts          # HTTP server (:3333)
  │   ├─ POST /upload-sessions
  │   └─ GET  /health
  └─ src/worker.ts       # BullMQ worker ("onescope-agent")
      └─ src/agents/lib/agentHandler.ts
          └─ src/agents/lib/runAgents.ts
              └─ src/agents/lib/runPrompts.ts
```

## Prerequisites

- Node.js 20+
- pnpm
- Redis (reachable from this app)
- Playwright Chromium deps installed

## Setup

```bash
pnpm install
pnpm --filter @onescope/agent build
pnpm --filter @onescope/agent typecheck
pnpm exec playwright install chromium
```

Create env file from example:

```bash
cp apps/agent/.env.example apps/agent/.env
```

## Authentication Flow

Run local login and upload in sequence:

```bash
pnpm --filter @onescope/agent run auth
```

Run only interactive login:

```bash
pnpm --filter @onescope/agent run login
```

Run one provider:

```bash
pnpm --filter @onescope/agent run auth:openai
pnpm --filter @onescope/agent run auth:anthropic
pnpm --filter @onescope/agent run auth:perplexity
pnpm --filter @onescope/agent run auth:google
```

Upload existing local sessions:

```bash
pnpm --filter @onescope/agent run upload-session
```

## Running

Development:

```bash
pnpm --filter @onescope/agent run dev
```

Production-style split:

```bash
pnpm --filter @onescope/agent run build
pnpm --filter @onescope/agent run start:api
pnpm --filter @onescope/agent run start:worker
```

## Environment Variables

Core:

| Variable | Required | Description |
|---|---|---|
| `LOCAL_AUTH_PROFILE_PATH` | yes (for local auth/upload) | Local storage path for provider auth JSON files |
| `VPS_AUTH_PROFILE_PATH` | yes (runtime) | Path used by API/worker to read auth sessions |
| `REDIS_HOST` | yes | Redis host |
| `REDIS_PORT` | yes | Redis port |
| `REDIS_PASSWORD` | no | Redis password |
| `VPS_API_URL` | yes (for upload) | Base URL of API server |
| `API_AUTH_TOKEN` | yes (for upload/API auth) | Shared bearer token for `/upload-sessions` |
| `DEBUG_ENABLED` | no | Enables debug logs when `true` |

Proxy:

| Variable | Required | Description |
|---|---|---|
| `PROXY_SOURCE_MODE` | no | `auto` or `manual` |
| `PROXY_MANUAL_FILE` | if manual mode | File with `host:port` lines |
| `PROXY_API_URL` | if API mode | Endpoint returning newline-separated proxies |
| `PROXY_CACHE_TTL_MS` | no | Proxy snapshot cache TTL |

Retry/tuning:

| Variable | Required | Description |
|---|---|---|
| `AGENT_WORKER_CONCURRENCY` | no | Worker concurrency, defaults to 1 |
| `MAX_PROMPT_RETRIES_PER_IP` | no | Per-prompt retries after proxy is proven |
| `PROMPT_RETRY_DELAY_MS` | no | Prompt retry base delay |
| `MAX_PROMPT_RETRY_DELAY_MS` | no | Prompt retry delay cap |
| `MAX_EXTRACTION_RETRIES` | no | Markdown extraction retries |
| `EXTRACTION_RETRY_DELAY_MS` | no | Extraction retry base delay |
| `MAX_EXTRACTION_RETRY_DELAY_MS` | no | Extraction retry cap |

## HTTP Endpoints

- `POST /upload-sessions`
- Headers: `Authorization: Bearer <API_AUTH_TOKEN>`, `Content-Type: application/json`
- Body: provider-keyed JSON storage state payloads

- `GET /health`
- Returns API timestamp, Redis ping status, and session-file presence by provider

## Supported Providers

- `openai`
- `anthropic`
- `perplexity`
- `google`
- `google-ai-overview` (shares Google auth session)

## Troubleshooting

- `Unknown provider`: verify queue payload provider matches supported list.
- `not authenticated`: run `pnpm --filter @onescope/agent run auth`.
- `proxy pool exhausted`: verify `PROXY_MANUAL_FILE` or `PROXY_API_URL`.
- frequent CAPTCHA/bot detection: rotate/refresh proxy source and reduce concurrency.

## Relevant Paths

- API: `apps/agent/src/api.ts`
- Worker: `apps/agent/src/worker.ts`
- Agent orchestration: `apps/agent/src/agents/lib/agentHandler.ts`
- Prompt runtime: `apps/agent/src/agents/lib/runPrompts.ts`
- Proxy pool: `apps/agent/src/lib/browser/proxyPool.ts`

## Optimization Plan (No Logic Changes)

This section is a full cleanup/modularity plan for `apps/agent` that keeps behavior the same while reducing redundancy and improving maintainability.

### Guiding Rules

- Keep runtime behavior and retry policy unchanged.
- Prefer extraction and composition over rewrites.
- Land in small phases with typecheck after each phase.
- Avoid changing provider-specific selector behavior while refactoring.

### Priority 0: Safe Foundation

1. Add shared helper utilities and keep old call sites behavior-identical.
2. Replace broad `any` error handling with `unknown` + `getErrorMessage(err)` helper.
3. Move repeated magic numbers into named constants local to each module.
4. Keep exports backward-compatible during refactor.

### Priority 1: Cross-Cutting Deduplication

Create shared utilities:

- `src/lib/core/retry.ts`
  - `withRetry()`, `isFinalAttempt()`, retry logging hooks.
- `src/lib/core/poll.ts`
  - generic `pollUntil()` used by auth/generation waits.
- `src/lib/core/time.ts`
  - `sleep(ms)`, `exponentialBackoff()` re-export.
- `src/lib/core/errors.ts`
  - `getErrorMessage(err)`, typed error guards.
- `src/lib/dom/locatorUtils.ts`
  - `findFirstVisibleFromSelectors()`, `findLastVisibleFromSelectors()`.
- `src/lib/extraction/sourceUtils.ts`
  - URL normalization, domain extraction, favicon URL, dedupe helper.

### Priority 2: Agent Runtime Cleanup

#### `src/agents/lib/runPrompts.ts`

- Split orchestration from per-attempt execution:
  - `runPromptWithPolicy()`
  - `executePromptAttempt()`
  - `buildIpRefreshNeededError()`
- Extract repeated waits into named constants.
- Centralize extraction-failure detection regex.
- Keep canary logic exactly as-is, but isolate it into a small policy object.

#### `src/agents/lib/agentHandler.ts`

- Extract cycle/attempt loop into:
  - `runProxyCycle()`
  - `runSingleProxyAttempt()`
- Extract payload update after `IPRefreshNeededError`.
- Extract cleanup block (`closeContextAndBrowser`) so close behavior/logging is uniform.
- Keep `PROXIES_PER_CYCLE`, `MAX_CYCLES`, timeout values unchanged.

#### `src/agents/lib/runAgents.ts`

- Replace inline warmup step lambda with a named function for readability.
- Keep sequencing identical (`warmUpEditor` then `runPrompts`).

### Priority 3: Browser + Proxy Modules

#### `src/lib/browser/proxyPool.ts`

- Split into focused modules:
  - `proxySource.ts` (manual/API/cached fetch)
  - `proxyScoring.ts` (score + cooldown policy)
  - `proxyStore.ts` (records/state/ring buffer)
  - `proxyPool.ts` (public API only)
- Extract repeated snapshot cache assignment into helper.
- Normalize proxies once at ingestion to avoid repeated normalization in loops.
- Keep cooldown durations and exploration rate unchanged.

#### `src/lib/browser/pageHealthCheck.ts`

- Convert to staged pipeline:
  - `detectBotChallenge()`
  - `detectLoginWall()`
  - `detectRateLimit()`
  - `findProviderEditor()`
  - `validateEditorInteractivity()`
- Use shared `failHealth(reason, failureType, userMessage)` builder.
- Keep check order and timeouts unchanged.

#### `src/lib/browser/navigateWithRetry.ts`

- Reuse shared `withRetry()`.
- Move retryable error match into `isRetryableNavigationError(msg)`.
- Keep default retries/delay unchanged.

### Priority 4: Input/DOM Utilities

#### Consolidate selector scanning

Current modules:
- `src/lib/input/findActiveEditor.ts`
- `src/lib/input/findEnabledSendButton.ts`
- `src/lib/input/findSourcesButton.ts`
- `src/lib/input/findAssistantElement.ts`
- `src/lib/input/isGenerating.ts`

Refactor:
- share generic selector iteration helpers.
- keep provider selector lists from `@onescope/utils` untouched.

#### `src/lib/input/waitForAssistantToFinish.ts`

- Replace inline polling loop with shared `pollUntil()`.
- Extract state tracker (`lastText`, `lastChange`, `seenOutput`) into helper.
- Keep timeout/stability thresholds exactly the same.

#### `src/lib/input/extractAssistantMarkdown.ts` and `getLastAssistantText.ts`

- Extract common “scan last visible assistant node” logic into one utility.
- Keep Anthropic special-case behavior unchanged.

### Priority 5: Provider-Specific Cleanup

#### Auth validators

Files:
- `src/agents/chatgpt/auth/validateAuth.ts`
- `src/agents/claude/auth/validateAuth.ts`
- `src/agents/google/gemini/auth/validateAuth.ts`
- `src/agents/perplexity/auth/validateAuth.ts`

Optimization:
- Create provider auth-check adapter pattern:
  - `matchesProviderUrl()`
  - `hasProviderAuthSignals()`
  - optional `preHealthWait()`
- Keep exact page signal checks and health-check invocation behavior.

#### Source extractors

Files:
- `src/agents/chatgpt/lib/extractSources.ts`
- `src/agents/claude/lib/extractSources.ts`
- `src/agents/perplexity/lib/extractSources.ts`
- `src/agents/google/gemini/lib/extractSources.ts`
- `src/agents/google/ai-overview/lib/extractSources.ts`

Optimization:
- Use shared source helper functions for URL/domain/favicon/dedupe.
- Keep provider-specific DOM traversal and parsing rules untouched.

### Priority 6: Worker/API/Auth Structure

#### `src/worker.ts`

- Extract progress persistence into `src/worker/progressStore.ts`.
- Extract provider execution into `src/worker/providerExecution.ts`.
- Keep Redis keys and payload shape unchanged.

#### `src/api.ts`

- Extract route handlers:
  - `handleUploadSessions()`
  - `handleHealthCheck()`
- Extract auth/token/header validation helpers.
- Keep endpoint URLs and response shapes unchanged.

#### Auth scripts (`src/auth/*.ts`)

- Centralize env bootstrapping via `src/env.ts` import.
- Extract repetitive provider labels/status summary formatting.
- Keep CLI flow and command behavior unchanged.

### Phase Plan (Recommended Order)

1. Add shared `core` + `dom` + `extraction` utilities.
2. Refactor `navigateWithRetry`, `waitForAssistantToFinish`, and simple input helpers to use shared utilities.
3. Refactor `runPrompts` and `agentHandler` into smaller functions.
4. Split `proxyPool` into modules.
5. Refactor provider auth/source modules to shared helpers.
6. Split `worker.ts` and `api.ts` into focused internal modules.

### Validation Checklist Per Phase

- `pnpm --filter @onescope/agent run typecheck`
- `pnpm --filter @onescope/agent run build`
- Smoke run:
  - one auth check
  - one provider job with sources extraction
  - one proxy-failure scenario (to confirm refresh path)

### Expected Outcomes

- Smaller, testable functions and cleaner module boundaries.
- Less duplicated retry/polling/selector traversal code.
- Easier provider maintenance when UI selectors change.
- Faster onboarding due to clearer responsibility per file.
