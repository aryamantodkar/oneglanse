# Web App + Packages — Detailed Analysis

> **No code was changed. This document is for review only.**
> See root [`ANALYSIS.md`](../../ANALYSIS.md) for the cross-codebase priority matrix.

---

## Architecture Overview

```
apps/web/src/
├── app/                    — Next.js 15 App Router
│   ├── (auth)/             — Protected routes (dashboard, workspace, settings, schedule)
│   ├── api/                — API routes (tRPC endpoint, auth)
│   ├── login/ signup/      — Public auth pages
├── server/api/
│   ├── routers/            — tRPC routers (workspace, prompt, location, analysis, agent, internal)
│   ├── middleware/         — isAuthenticated, isInternal, authorizedWorkspace
│   ├── procedures.ts       — protectedProcedure, publicProcedure
│   └── root.ts             — Router composition
└── trpc/                   — Client-side tRPC setup

packages/
├── db/       — Drizzle ORM, PostgreSQL schema, ClickHouse schema
├── services/ — Business logic: LLM, analysis, prompt, workspace, agent queue
├── types/    — Shared TypeScript types
├── errors/   — safeHandler, error mapping
└── utils/    — Shared utilities
```

---

## Issue W1 — Internal Route Auth Bypass ⚠️ CRITICAL

**Severity:** CRITICAL
**File:** `src/server/api/middleware/isInternal.ts:9`

```typescript
export const isInternal = t.middleware(({ next, ctx }) => {
  const auth = ctx.headers.get("Authorization");

  if (auth !== `Bearer ${process.env.INTERNAL_CRON_SECRET}`) {
    throw new AuthError("Cron Secret is missing or invalid.");
  }
  return next();
});
```

## Issue W3 — ClickHouse Pagination Infinite Loop ⚠️ CRITICAL

**Severity:** CRITICAL
**File:** `packages/services/src/analysis/analysis.ts:59-75`

```typescript
let hasMore = true;
while (hasMore) {
  const result = await clickhouse.query({
    query: `SELECT * FROM analytics.prompt_responses
            WHERE workspace_id = {workspaceId:String}
            LIMIT {batchSize:UInt32}`,  // ← NO OFFSET
    query_params: { workspaceId, batchSize },
    format: "JSONEachRow",
  });
  const responses: PromptResponse[] = await result.json();
  if (responses.length === 0) break;

  // process batch...
  // hasMore is only set to false when no results returned
}
```

**The bug:** There is no `OFFSET` clause. Every iteration of the loop fetches the **same** first `batchSize` rows from ClickHouse. The loop only terminates if `responses.length === 0`, which never happens because the first batch always exists. This results in:

1. **Infinite loop** that processes the same records repeatedly
2. **Unlimited OpenAI API calls** for every analysis trigger (charged per token)
3. **Worker thread blocked** until process is killed

**Fix — cursor-based pagination:**
```typescript
let offset = 0;
const batchSize = 100;

while (true) {
  const result = await clickhouse.query({
    query: `SELECT * FROM analytics.prompt_responses
            WHERE workspace_id = {workspaceId:String}
            ORDER BY created_at
            LIMIT {batchSize:UInt32}
            OFFSET {offset:UInt32}`,
    query_params: { workspaceId, batchSize, offset },
    format: "JSONEachRow",
  });
  const responses: PromptResponse[] = await result.json();
  if (responses.length === 0) break;

  // process batch...
  offset += responses.length;
}
```

---

## Issue W4 — Unsafe JSON.parse Without Schema Validation ⚠️ HIGH

**Severity:** HIGH
**Files:**
- `src/server/api/routers/agent/agent.ts:29`
- `src/server/api/routers/workspace/workspace.ts:588, 607, 652`

```typescript
// agent.ts:29
const enabledProviders = JSON.parse(enabledProvidersJson) as Provider[];

// workspace.ts:588
const enabledProviders = workspace.enabledProviders
  ? JSON.parse(workspace.enabledProviders)
  : ["openai", "anthropic", "perplexity", "google", "google-ai-overview"];
```

Both `JSON.parse` calls use raw `as Provider[]` type assertions with no runtime validation. If the database row contains corrupted or unexpected data, the application crashes with an unhandled JSON parse error, or worse, passes malformed data downstream.

**Fix:**
```typescript
import { z } from 'zod';

const ProvidersSchema = z.array(z.enum(['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview']));

function parseEnabledProviders(raw: string | null): Provider[] {
  if (!raw) return ['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview'];
  try {
    return ProvidersSchema.parse(JSON.parse(raw));
  } catch {
    // Log warning and return default
    logger.warn(`Invalid enabledProviders in DB: ${raw}`);
    return ['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview'];
  }
}
```

---

## Issue W6 — Manual Cron Expression Parsing

**Severity:** MEDIUM
**File:** `src/server/api/routers/workspace/workspace.ts:706-756`

```typescript
const cronParts = cronSchedule.split(' ');
const minute = cronParts[0];
const hour = cronParts[1];
// ...
const interval = parseInt(hour.substring(2)); // no bounds check
```

Manual cron parsing is fragile. `parseInt` returns `NaN` for invalid input, and there are no bounds checks to ensure hours are `0-23` and minutes are `0-59`. Invalid cron expressions can be stored to the database and will fail silently when the scheduler tries to use them.

**Fix:** Use the `cron-parser` library:
```typescript
import { parseExpression } from 'cron-parser';

function validateCronExpression(expr: string): boolean {
  try {
    parseExpression(expr);
    return true;
  } catch {
    return false;
  }
}
```

## Issue W8 — Missing Database Indexes

**Severity:** MEDIUM
**File:** `packages/db/src/schema/`

The following indexes are missing and would improve query performance on frequently-accessed patterns:

| Missing Index | Table | Query Pattern |
|---------------|-------|---------------|
| `(workspace_id, is_analysed)` | `user_prompts` | Analysis batch queries |
| `(workspace_id, is_analysed)` | `prompt_responses` | Analysis batch queries |
| `(refresh_token_expires_at)` | `account` | Auth cleanup/expiry |
| `(workspace_id, created_at)` | `prompt_responses` | Sorted pagination |

**Add to schema:**
```typescript
// In packages/db/src/schema/workspace.ts
(table) => ({
  // ... existing indexes ...
  workspaceAnalysisIdx: index('user_prompts_workspace_analysed_idx')
    .on(table.workspaceId, table.isAnalysed),
})
```

## Issue W11 — Environment Variable Not Validated at Startup

**Severity:** MEDIUM
**File:** Multiple (`apps/web/src/env.ts` or equivalent)

Key environment variables are consumed at runtime without upfront validation:

- `INTERNAL_CRON_SECRET` — can be `undefined`, bypassing auth (see W1)
- `OPENAI_API_KEY` — missing will crash on first analysis
- `DATABASE_URL` — missing will crash on first DB access (but at startup, not on first use)

**Fix:** Use a startup validation step:
```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  INTERNAL_CRON_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  CLICKHOUSE_URL: z.string().url(),
  REDIS_HOST: z.string().default('redis'),
});

export const env = EnvSchema.parse(process.env);
```

## Packages Analysis

### `packages/services`

**Issues found:**
- ClickHouse pagination bug — infinite loop with no OFFSET (W3)
- `runAnalysis.ts` uses `openai.responses.create()` with `model: "gpt-4.1"` — verify this is a valid/current model name. If the model is deprecated or renamed, analysis silently fails.
- `runAnalysisInBackground()` in worker fires-and-forgets with no retry mechanism. Failures are logged but not retried or tracked.

---

### `packages/errors`

**`safeHandler` is used widely** but has the type complexity issue noted in W10.

`captureException(err)` is called on all errors — verify this integrates with Sentry or another error tracker. If it's a no-op, all production errors are silently swallowed by `safeHandler`.

---