# OneGlanse — Coding Standards

Only standards with real violations in this codebase are listed. Each entry shows the actual offending code, the corrected version, and why it matters.

---

## Table of Contents

1. [Never Use `any`](#1-never-use-any)
2. [Never Use Non-Null Assertion `!`](#2-never-use-non-null-assertion-)
3. [Explicit Return Types on Exported Functions](#3-explicit-return-types-on-exported-functions)
4. [Always Use Custom Error Classes](#4-always-use-custom-error-classes)
5. [Fail Fast on Startup — Zod Env Validation](#5-fail-fast-on-startup--zod-env-validation)
6. [Never Access `process.env` Directly in Business Logic](#6-never-access-processenv-directly-in-business-logic)
7. [Never Hardcode Selectors in Business Logic](#7-never-hardcode-selectors-in-business-logic)
8. [Always Comment `waitForTimeout` Calls](#8-always-comment-waitfortimeout-calls)
9. [Use Structured Logging — Never `console.log`](#9-use-structured-logging--never-consolelog)
10. [JSDoc on All Exported Package Functions](#10-jsdoc-on-all-exported-package-functions)
11. [Never Use `SELECT *` in ClickHouse Queries](#11-never-use-select--in-clickhouse-queries)

---

## 1. Never Use `any`

`any` disables TypeScript entirely for that value. Use the actual type, or `unknown` if genuinely uncertain, then narrow.

**Problem** (`apps/web/src/components/app-sidebar.tsx:198`):
```typescript
groupedWorkspaces.map((group: any, idx: number) => (
```

**Problem** (`apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts:12`):
```typescript
analysedPromptData: any,
```

**Fix:**
```typescript
// Derive the type from what groupedWorkspaces actually is:
groupedWorkspaces.map((group: WorkspaceGroup, idx: number) => (

// Use the real type or unknown + narrowing:
analysedPromptData: PromptAnalysis,
```

**Explanation:** Every `any` is a hole in the type system. If `group` is typed `any`, TypeScript won't catch `group.nmae` (a typo), `group.members.map(m => m.workspaceId)` (wrong field), or a refactor that changes the shape — all silently fail at runtime instead of compile time.

---

## 2. Never Use Non-Null Assertion `!`

`!` tells TypeScript "trust me, this is never null" and turns off null checking for that expression. If you're wrong, you get a cryptic `Cannot read properties of undefined` with no context.

**Problem** (`apps/agent/src/lib/browser/proxy/pool.ts:67`):
```typescript
const topScore = candidates[0]!.score;
```

**Problem** (`apps/web/src/server/api/routers/agent/agent.ts:33`):
```typescript
const workspace = await getWorkspaceById({ workspaceId: workspaceId! });
```

**Problem** (`apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts:475,482,488`):
```typescript
(sum, r) => sum + r.brand_analysis!.geoScore.overall,
(sum, r) => sum + r.brand_analysis!.sentiment.score,
.map((r) => r.brand_analysis!.position.rankPosition)
```

**Fix:**
```typescript
// Guard before access:
if (candidates.length === 0) throw new NotFoundError('No proxy candidates available');
const topScore = candidates[0].score;

// Explicit check with meaningful error:
const workspace = await getWorkspaceById({ workspaceId });
if (!workspace) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });

// Filter before reducing:
records
  .filter((r): r is typeof r & { brand_analysis: BrandAnalysis } => r.brand_analysis != null)
  .reduce((sum, r) => sum + r.brand_analysis.geoScore.overall, 0)
```

**Explanation:** `candidates[0]!` crashes if `candidates` is empty — a real possibility when all proxies are exhausted. `r.brand_analysis!` crashes for any record that was stored before brand analysis ran. The `!` hides both bugs from the compiler.

---

## 3. Explicit Return Types on Exported Functions

TypeScript infers return types, but explicit types serve as enforced contracts. Without them, a refactor that accidentally changes what a function returns silently breaks all callers.

**Problem** (`packages/services/src/analysis/runAnalysis.ts:6`):
```typescript
export async function runAnalysis(input: AnalysisInputSingle) {
```

**Problem** (`packages/services/src/prompt/index.ts`):
```typescript
export async function configureSchedulerSecrets() {
```

**Problem** (`packages/services/src/agent/redis.ts:19`):
```typescript
export async function waitForRedis() {
```

**Problem** (`packages/services/src/analysis/analysisPrompt.ts:3`):
```typescript
export function analysisPrompt(input: AnalysisInputSingle) {
```

**Fix:**
```typescript
export async function runAnalysis(input: AnalysisInputSingle): Promise<AnalysisResult> {
export async function configureSchedulerSecrets(): Promise<void> {
export async function waitForRedis(): Promise<void> {
export function analysisPrompt(input: AnalysisInputSingle): string {
```

**Explanation:** Rule: all functions exported from a package must have explicit return types. Internal helpers may omit them. The return type is the public contract — it documents what callers can expect and catches silent regressions when the body changes.

---

## 4. Always Use Custom Error Classes

Never throw plain `new Error()` in application code. Custom error classes carry semantic meaning — callers can check `err instanceof NotFoundError` vs `err instanceof AuthError` and respond differently. A plain `Error` forces callers to parse the message string.

**Problem** (`apps/agent/src/worker/jobHandler.ts:86`):
```typescript
throw new Error(`Unknown provider: ${provider}`);
```

**Problem** (`apps/agent/src/lib/input/editor/findEditor.ts:34`):
```typescript
throw new Error("❌ No active prompt editor found");
```

**Problem** (`packages/services/src/agent/redis.ts:31`):
```typescript
throw new Error("Redis not available");
```

**Problem** (`apps/agent/src/lib/browser/proxy/snapshot.ts:62`):
```typescript
throw new Error(`Proxy API returned ${res.status}: ${res.statusText}`);
```

**Fix:**
```typescript
// Use the existing error classes from @oneglanse/errors:
import { ValidationError, NotFoundError, DatabaseError } from '@oneglanse/errors';

throw new ValidationError(`Unknown provider: ${provider}`, { provider });
throw new NotFoundError('No active prompt editor found');
throw new DatabaseError('Redis not available');
throw new DatabaseError(`Proxy API error ${res.status}`, { status: res.status, statusText: res.statusText });
```

**Explanation:** `@oneglanse/errors` already exports `DatabaseError`, `NotFoundError`, `AuthError`, `ValidationError`. Using them means error monitoring (Sentry, logs) can group by error class, not by message string. A `DatabaseError` in a dashboard tells you immediately it's a DB issue — `Error: Redis not available` does not.

---

## 5. Fail Fast on Startup — Zod Env Validation

Never access `process.env` at runtime without validating at startup. An undefined env var discovered mid-request causes a confusing runtime crash (or silent `NaN`, `undefined`) — not a clear startup error.

**Problem** (`apps/agent/src/worker.ts:14,24-28`):
```typescript
const concurrency = Number(process.env.AGENT_WORKER_CONCURRENCY ?? "1");

const connection = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD,
});
```

**Fix** — create `apps/agent/src/env.ts`:
```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  REDIS_HOST: z.string().min(1).default('redis'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  AGENT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
  API_BASE_URL: z.string().url(),
  INTERNAL_CRON_SECRET: z.string().min(32),
  MIN_RESPONSE_CHARS: z.coerce.number().int().min(0).default(600),
});

// Throws immediately on startup if any required var is missing or invalid:
export const env = EnvSchema.parse(process.env);
```

Then in `worker.ts`:
```typescript
import { env } from './env.js';

const concurrency = env.AGENT_WORKER_CONCURRENCY; // number, guaranteed
const connection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
});
```

**Explanation:** With `z.coerce.number()`, `REDIS_PORT=abc` throws `ZodError: Expected number, received nan` on startup — not a silent `NaN` passed to Redis three requests later. The entire agent currently starts without verifying `API_BASE_URL` or `INTERNAL_CRON_SECRET` are set, meaning the cron scheduler silently fails to configure unless those vars happen to be present.

---

## 6. Never Access `process.env` Directly in Business Logic

Once `env.ts` exists (see §5), no file outside it should access `process.env`. Direct access bypasses validation, has `string | undefined` type (not the validated type), and scatters configuration reads across the codebase.

**Problem** (`apps/agent/src/lib/validation/validateResponse.ts:3`):
```typescript
const MIN_RESPONSE_CHARS = Number(process.env.MIN_RESPONSE_CHARS ?? 600);
```

**Problem** (`apps/agent/src/lib/utils/logger.ts:2`):
```typescript
process.env.DEBUG_ENABLED === "true" || process.env.NODE_ENV !== "production";
```

**Problem** (`packages/services/src/prompt/index.ts:125`):
```typescript
const apiBaseUrl = process.env.API_BASE_URL;
const cronSecret = process.env.INTERNAL_CRON_SECRET;
```

**Fix:**
```typescript
// validateResponse.ts — import from the validated env object:
import { env } from '../../env.js';
const MIN_RESPONSE_CHARS = env.MIN_RESPONSE_CHARS; // number, already coerced

// logger.ts:
import { env } from '../../env.js';
const debugEnabled = env.DEBUG_ENABLED || env.NODE_ENV !== 'production';

// prompt/index.ts:
import { env } from '../../../apps/agent/src/env.js'; // or pass as args
const apiBaseUrl = env.API_BASE_URL; // string, guaranteed by Zod
```

**Explanation:** `Number(process.env.MIN_RESPONSE_CHARS ?? 600)` silently becomes `NaN` if someone sets `MIN_RESPONSE_CHARS=` (empty string), allowing empty agent responses through. The Zod schema catches this at startup.

---

## 7. Never Hardcode Selectors in Business Logic

All CSS selectors must live in a centralized config file. Selectors buried in extraction logic are invisible — when a provider changes its DOM, you have no idea which files to update.

**Problem** (`apps/agent/src/agents/chatgpt/lib/extractSources.ts:26-32`):
```typescript
Array.from(document.querySelectorAll('[role="dialog"]')).find((d) =>
  d.querySelector('a[href^="http"]'),
) ||
document.querySelector('[data-testid*="sources"]') ||
document.querySelector('[class*="sources"]') ||
document.querySelector('[class*="citation"]') ||
```

**Problem** (`apps/agent/src/agents/google/ai-overview/lib/extractResponse.ts:12,14`):
```typescript
document.querySelector('[data-container-id="model-response-placeholder"]') ||
document.querySelector('[data-container-id="main-col"]')?.parentElement;
```

**Problem** (`apps/agent/src/agents/gemini/lib/extractSources.ts:40-41`):
```typescript
card.querySelector(".title")?.textContent?.trim() ||
card.querySelector(".source-path")?.textContent?.trim() ||
```

**Fix** — create `apps/agent/src/config/selectors.ts`:
```typescript
export const SELECTORS = {
  openai: {
    sourcesFlyout: [
      'div[class*="threadFlyOut"]',
      'aside',
      '[role="dialog"]:has(a[href^="http"])',
      '[data-testid*="sources"]',
      '[class*="sources"]',
      '[class*="citation"]',
    ],
  },
  google: {
    sourceCard: 'inline-source-card',
    cardTitle: ['.title', '.source-path'],
    cardSnippet: '.snippet',
  },
  'google-ai-overview': {
    responseContainer: [
      '[data-container-id="model-response-placeholder"]',
      '[data-container-id="main-col"]',
    ],
    rhsColumn: '[data-container-id="rhs-col"]',
  },
} as const;
```

Then in extraction files:
```typescript
import { SELECTORS } from '../../../config/selectors.js';

const flyout = SELECTORS.openai.sourcesFlyout
  .map(sel => document.querySelector(sel))
  .find(Boolean);
```

**Explanation:** When ChatGPT changes `threadFlyOut` to `threadSourcePanel`, you search `selectors.ts` — one file — instead of grepping through every extraction file hoping you found all instances. It also makes DOM breakages immediately visible: the selector map is the spec for what each provider's DOM is expected to look like.

---

## 8. Always Comment `waitForTimeout` Calls

`waitForTimeout` is a fixed sleep with no condition. It is always fragile. Every call must have a comment explaining exactly what it is waiting for and why a fixed delay is necessary.

**Problem** (`apps/agent/src/lib/input/editor/warmUp.ts:11,19`):
```typescript
await page.waitForTimeout(300);
// ... more code ...
await page.waitForTimeout(200);
```

**Problem** (`apps/agent/src/agents/core/steps/askPrompt.ts:46,61,73,76`):
```typescript
await page.waitForTimeout(500);
await page.waitForTimeout(200);
await page.waitForTimeout(300);
await page.waitForTimeout(100);
```

**Problem** (`apps/agent/src/agents/core/steps/extractSources.ts:29,35`):
```typescript
await page.waitForTimeout(1000);
// ... sources extracted ...
await page.waitForTimeout(1000);
```

**Fix:**
```typescript
// Warm up the editor — React's synthetic input event requires a brief
// settle time before the send button activates (~200-300ms observed):
await page.waitForTimeout(300);

// After dispatching Enter, the prompt input re-renders; without this pause
// the next keypress lands in the new empty field instead of the chat:
await page.waitForTimeout(200);

// Allow the sources panel animation to complete before reading the DOM.
// The panel uses a CSS transition (~800ms); 1000ms gives consistent results:
await page.waitForTimeout(1000);
```

**Better where possible — replace with a condition:**
```typescript
// Instead of sleeping, wait for the actual DOM state that indicates readiness:
await page.waitForSelector('[data-testid="stop-button"]', { timeout: 5000 });
await page.waitForSelector('.response-complete', { timeout: 30_000 });
```

**Explanation:** There are 24+ uncommented `waitForTimeout` calls in the agent. When one of them causes a flaky test or a slow run, there is no way to know which wait is for what without reading the surrounding logic. A comment turns a magic number into documented intent. A condition-based wait is better still because it adapts to fast and slow environments rather than always waiting the full duration.

---

## 9. Use Structured Logging — Never `console.log`

The codebase has a logger in `apps/agent/src/lib/utils/logger.ts`. In `apps/web`, use the server logger or a proper client logger. Raw `console.log` output is unsearchable, unseverable, and not filterable in production.

**Problem** (`apps/agent/src/lib/utils/runStep.ts:11`):
```typescript
console.log(`\n▶️  ${name}`);
```

**Problem** (`apps/web/src/components/forms/login-form.tsx:67`):
```typescript
console.log(err);
```

**Problem** (`apps/web/src/components/dialogs/create-workspace-dialog.tsx:105`):
```typescript
console.error(err);
```

**Problem** (`apps/web/src/server/api/routers/workspace/workspace.ts:693,718,747`):
```typescript
console.error("Error calculating next run:", err);
```

**Fix** (agent):
```typescript
import { logger } from '../../lib/utils/logger.js';

logger.log(`Running step: ${name}`);
logger.error('Step failed', { step: name, error: err instanceof Error ? err.message : String(err) });
```

**Fix** (web — server-side tRPC routers):
```typescript
import { logger } from '@oneglanse/errors';

logger.error('Failed to calculate next run', {
  cronSchedule,
  error: err instanceof Error ? err.message : String(err),
});
```

**Fix** (web — client-side components):
```typescript
// In client components, surface errors to the user via toast; don't log to console:
import { toast } from 'sonner';

try {
  await createWorkspace(input);
} catch (err) {
  toast.error('Failed to create workspace');
  // If you need visibility, send to an error tracking service, not console
}
```

**Explanation:** `console.log(err)` in the login form means every failed login attempt silently prints a raw Error object to the browser console — visible to anyone with DevTools open. `console.error("Error calculating next run:", err)` in the tRPC router means the error is invisible in structured log aggregation. The agent logger already exists and is wired to `DEBUG_ENABLED` — use it everywhere.

---

## 10. JSDoc on All Exported Package Functions

Every function exported from a package (`packages/*/src/index.ts`) must have a JSDoc comment. These functions are the inter-package API; without documentation a caller has to read the implementation to understand what to pass and what to expect back.

**Problem** (`packages/services/src/prompt/index.ts`):
```typescript
export async function storePromptResponses(args: {
  results: ModelResult;
  userId: string;
  workspaceId: string;
  promptRunAt: string;
}) {
```

**Problem** (`packages/services/src/analysis/runAnalysis.ts`):
```typescript
export async function runAnalysis(input: AnalysisInputSingle): Promise<AnalysisResult> {
```

**Problem** (`packages/services/src/workspace/index.ts`):
```typescript
export async function getAllWorkspacesForUser(args: { userId: string }) {
```

**Fix:**
```typescript
/**
 * Persists prompt responses from one or more providers to ClickHouse.
 *
 * Called immediately when a provider's job completes — does not wait
 * for all providers to finish. Handles individual-record fallback
 * if the batch insert fails.
 *
 * @param args.results   - Full ModelResult map; only 'fulfilled' entries are stored.
 * @param args.userId    - The user who submitted the prompts.
 * @param args.workspaceId - Workspace scope for all inserted rows.
 * @param args.promptRunAt - ISO timestamp used as prompt_run_at for all rows.
 */
export async function storePromptResponses(args: {
  results: ModelResult;
  userId: string;
  workspaceId: string;
  promptRunAt: string;
}): Promise<void> {
```

**Explanation:** `packages/services` is imported by both `apps/web` and `apps/agent`. When a web developer calls `storePromptResponses`, they should not have to open `packages/services/src/prompt/index.ts` to understand what `promptRunAt` is, whether the function throws, or whether it handles partial failures. The JSDoc is the contract.

---

## 11. Never Use `SELECT *` in ClickHouse Queries

`SELECT *` fetches every column in the table, including columns added in future schema changes. In ClickHouse, this is especially expensive because ClickHouse is columnar — it reads only the columns you request. `SELECT *` defeats that optimization entirely.

**Problem** (`packages/services/src/prompt/index.ts`):
```typescript
const result = await clickhouse.query({
  query: `
    SELECT *
    FROM analytics.prompt_responses
    WHERE workspace_id = {workspaceId:String}
  `,
  query_params: { workspaceId },
  format: "JSONEachRow",
});
```

**Problem** (`packages/services/src/analysis/analysis.ts`):
```typescript
query: `
  SELECT *
  FROM analytics.prompt_responses
  WHERE workspace_id = {workspaceId:String}
  AND is_analysed = false
`,
```

**Fix:**
```typescript
// fetchPromptResponsesForWorkspace — only select what PromptResponse needs:
query: `
  SELECT
    id, prompt_id, prompt, user_id, workspace_id,
    model, model_provider, response, sources,
    prompt_run_at, brand_analysis, is_analysed
  FROM analytics.prompt_responses
  WHERE workspace_id = {workspaceId:String}
`,

// analysis.ts — only select columns needed for analysis input:
query: `
  SELECT id, prompt_id, prompt, model_provider, response, sources, prompt_run_at
  FROM analytics.prompt_responses
  WHERE workspace_id = {workspaceId:String}
  AND is_analysed = false
`,
```

**Explanation:** ClickHouse reads data in column strips from disk. `SELECT *` on `prompt_responses` reads the full `response` text column (potentially megabytes per row) even when the caller only needs `id` and `model_provider`. Column-explicit queries also break loudly when the schema changes instead of silently returning extra fields that callers may handle incorrectly.
