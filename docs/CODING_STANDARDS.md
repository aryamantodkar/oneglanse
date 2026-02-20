# OneScope AI — Coding Standards, Naming Conventions & OSS Best Practices

This document defines the standards every contributor to OneScope AI must follow. These aren't arbitrary rules — each convention is explained with the reasoning behind it. Understanding *why* a rule exists helps you apply it correctly in situations that aren't explicitly covered.

---

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [TypeScript Best Practices](#2-typescript-best-practices)
3. [File & Folder Structure Conventions](#3-file--folder-structure-conventions)
4. [Error Handling Standards](#4-error-handling-standards)
5. [Async / Promise Patterns](#5-async--promise-patterns)
6. [Environment & Configuration](#6-environment--configuration)
7. [Database Standards](#7-database-standards)
8. [API Design (tRPC)](#8-api-design-trpc)
9. [Browser Automation Standards](#9-browser-automation-standards)
10. [Logging Standards](#10-logging-standards)
11. [Git & Commit Standards](#11-git--commit-standards)
12. [Documentation Standards](#12-documentation-standards)
13. [Security Standards](#13-security-standards)
14. [Performance Standards](#14-performance-standards)
15. [Open Source Standards (OSS)](#15-open-source-standards-oss)
16. [Code Review Standards](#16-code-review-standards)

---

## 1. Naming Conventions

Consistent naming makes code navigable without having to open every file to understand what it does.

### 1.1 — Variables & Parameters

Use **camelCase** for all variables and function parameters. The name should describe the data it holds — not its type.

```typescript
// ✅ Good — describes what it IS:
const workspaceId = 'ws_abc123';
const maxRetries = 3;
const isAuthenticated = true;
const promptResults: AskPromptResult[] = [];

// ❌ Bad — describes the type instead of the value:
const str = 'ws_abc123';       // What kind of string?
const num = 3;                 // What number?
const bool = true;             // True what?
const arr: AskPromptResult[] = []; // What is this an array OF?

// ❌ Bad — abbreviations that require mental decoding:
const wpId = 'ws_abc123';      // "wp" = workspace? widget? web page?
const maxR = 3;                // "maxR" = max retries? max radius?
const res = await getResult(); // "res" = result? response? resource?
```

**Single-letter variables** are allowed ONLY in short lambdas and array callbacks where the type is immediately obvious from context:

```typescript
// ✅ Acceptable — context makes 'p' clearly a Provider:
const providers = PROVIDERS.filter(p => enabledProviders.includes(p));

// ✅ Acceptable — 'i' in a tight numeric loop:
for (let i = 0; i < prompts.length; i++) { ... }

// ❌ Not acceptable — the type is not obvious:
results.map(r => r.id)  // What is r? Use: results.map(result => result.id)
```

### 1.2 — Functions

Use **camelCase** for functions. Function names should be **verb phrases** that describe the action performed:

```typescript
// ✅ Good — starts with a verb, describes what happens:
function extractSources(page: Page, provider: Provider): Promise<AgentCitation[]> {}
function validateAuth(page: Page, provider: Provider): Promise<boolean> {}
function formatDateToClickHouse(date: Date): string {}
function createWorkspaceForTenant(data: CreateWorkspaceInput): Promise<Workspace> {}
function isAuthenticated(page: Page): Promise<boolean> {}  // Boolean predicates use 'is/has/can/should'

// ❌ Bad — noun-only names that don't describe the action:
function workspace(data: CreateWorkspaceInput): Promise<Workspace> {}  // Create? Get? Validate?
function sourcesExtractor() {}   // Should be extractSources
function authCheck() {}          // Should be validateAuth or isAuthenticated

// ❌ Bad — vague verbs:
function handlePrompt() {}       // Handle how? Submit? Store? Analyze?
function processData() {}        // Process what? How?
function doTheThing() {}         // Never acceptable
```

**Boolean functions** must use the `is`, `has`, `can`, or `should` prefix:

```typescript
// ✅ Good — reads like English:
function isAuthenticated(page: Page): boolean {}
function hasExpiredSession(state: AuthState): boolean {}
function canAddMember(user: User, workspace: Workspace): boolean {}
function shouldRetryPrompt(error: Error, attempt: number): boolean {}

// ❌ Bad — could be a noun OR a boolean:
function authenticated(page: Page): boolean {}  // Is this getting auth state or checking it?
function expiredSession(): boolean {}            // Is this returning a session or checking expiry?
```

### 1.3 — Classes & Types

Use **PascalCase** for classes, interfaces, type aliases, enums, and generic type parameters:

```typescript
// ✅ Classes:
class ProxyPool {}
class BrowserSession {}
class WorkspaceService {}

// ✅ Interfaces — prefer noun phrases describing the shape:
interface AgentConfig {}          // Config for an agent
interface SourceExtractorConfig {}
interface WorkspaceCreateInput {} // Input for creating workspace

// ✅ Type aliases:
type Provider = 'openai' | 'anthropic' | 'perplexity' | 'google' | 'google-ai-overview';
type AskPromptResult = { ... };
type BrandAnalysisResult = { ... };

// ✅ Generic type parameters — use descriptive names, not single letters:
// Single letters (T, K, V) are acceptable ONLY for truly generic utilities:
function identity<T>(value: T): T { return value; }

// For domain-specific generics, use descriptive names:
async function fetchPage<TRecord extends { id: string }>(
  query: ClickHouseQuery<TRecord>
): Promise<TRecord[]> {}

// ❌ Bad PascalCase for variables/functions:
const WorkspaceId = 'ws_123';  // PascalCase implies class/type — confusing
function GetWorkspace() {}      // PascalCase for functions is confusing (looks like a class)
```

### 1.4 — Constants

Use **SCREAMING_SNAKE_CASE** for constants that are truly fixed values — not for every `const` variable:

```typescript
// ✅ Use SCREAMING_SNAKE_CASE for module-level configuration constants:
const MAX_PROXY_RETRIES = 10;
const PROVIDER_TIMEOUT_MS = 25 * 60 * 1000;  // 25 minutes
const DEFAULT_WARMUP_DELAY = 2000;
const ALLOWED_PROVIDERS = new Set(['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview']);

// ❌ Do NOT use SCREAMING_SNAKE_CASE for:
// - Regular variables that happen to be const:
const WORKSPACE = await getWorkspace(id);  // This is a runtime value, not a constant
const USER_NAME = user.name;               // This is a variable, not a configuration constant

// ❌ Do NOT use const with camelCase for config constants:
const maxProxyRetries = 10;  // This LOOKS like a variable — is it changeable?
const providerTimeout = 25 * 60 * 1000;  // Unclear if this is configurable or fixed
```

### 1.5 — Files & Directories

```
Rule: Use the name of the primary export. If a file exports one thing, name it after that thing.
```

```
apps/agent/src/
├── agents/
│   ├── lib/
│   │   ├── createAgent.ts         ← Exports: createAgent()
│   │   ├── extractSources.ts      ← Exports: extractSources()
│   │   ├── runAgents.ts           ← Exports: runAgents()
│   │   └── agentHandler.ts        ← Exports: agentHandler()
│   ├── chatgpt/
│   │   └── auth/
│   │       └── validateAuth.ts    ← Exports: validateAuth() for chatgpt
├── lib/
│   ├── browser/
│   │   ├── launchContext.ts       ← Exports: launchContext()
│   │   ├── proxyPool.ts           ← Exports: ProxyPool class
│   │   └── navigateWithRetry.ts   ← Exports: navigateWithRetry()
│   └── input/
│       ├── askPrompt.ts           ← Exports: askPrompt()
│       └── extractAssistantMarkdown.ts  ← Exports: extractAssistantMarkdown()
└── config/
    ├── providers.ts               ← Exports: AGENT_CONFIGS
    └── selectors.ts               ← Exports: SELECTORS
```

**Directory naming:**
- Always **kebab-case** for directories: `ai-overview/`, `lib/`, `browser/`, `__tests__/`
- Never PascalCase or camelCase directories: ~~`AiOverview/`~~, ~~`aiOverview/`~~

**Special directory conventions:**
- `__tests__/` — test files (double underscore, lowercase)
- `lib/` — shared utilities within an app (not exported to other packages)
- `config/` — configuration files and constants

### 1.6 — Environment Variables

Environment variables use **SCREAMING_SNAKE_CASE** with a meaningful prefix:

```bash
# ✅ Good — clear, descriptive, prefixed by domain:
DATABASE_URL=
REDIS_HOST=
REDIS_PORT=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OPENAI_API_KEY=
AGENT_WORKER_CONCURRENCY=
VPS_AUTH_PROFILE_PATH=
PROXY_API_URL=
PROXY_SOURCE_MODE=
INTERNAL_CRON_SECRET=

# Next.js public env vars (exposed to the browser — use NEXT_PUBLIC_ prefix):
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_POSTHOG_KEY=

# ❌ Bad — unclear, not descriptive:
SECRET=
URL=
CONCURRENCY=
TOKEN=
```

### 1.7 — Enum Members

Enum members use **SCREAMING_SNAKE_CASE**:

```typescript
// ✅ Good:
enum FailureType {
  BOT_DETECTION = 'bot_detection',
  RATE_LIMITED = 'rate_limited',
  CONNECTION_ERROR = 'connection_error',
  AUTH_EXPIRED = 'auth_expired',
}

// ❌ Bad:
enum FailureType {
  botDetection = 'botDetection',  // camelCase for enum values is confusing
  BotDetection = 'BotDetection',  // PascalCase is the Rust convention, not TypeScript
}
```

### 1.8 — React Components

Use **PascalCase** for component names, and name the file after the component:

```typescript
// ✅ Good:
// File: components/workspace/WorkspaceCard.tsx
export function WorkspaceCard({ workspace }: WorkspaceCardProps) {}

// File: components/forms/CreateWorkspaceForm.tsx
export function CreateWorkspaceForm() {}

// ❌ Bad:
// File: components/workspace/card.tsx   ← lowercase filename
export function workspaceCard() {}       ← camelCase component
```

**Event handler props** use `on` prefix:

```typescript
// ✅ Good:
interface WorkspaceCardProps {
  workspace: Workspace;
  onDelete: (workspaceId: string) => void;
  onSelect: (workspace: Workspace) => void;
  isLoading?: boolean;
}

// ❌ Bad:
interface WorkspaceCardProps {
  workspace: Workspace;
  delete: (id: string) => void;    // 'delete' is a reserved word; also unclear who calls it
  handleSelect: (ws: Workspace) => void;  // 'handle' is an implementation detail, not a prop name
}
```

---

## 2. TypeScript Best Practices

### 2.1 — Never Use `any`

`any` disables TypeScript entirely. Use `unknown` when the type is genuinely unknown, then narrow it:

```typescript
// ❌ Bad — disables type checking:
function parseResponse(data: any): any {
  return data.result;  // TypeScript can't catch data.reslt (typo) here
}

// ✅ Good — uses unknown, narrows the type:
function parseResponse(data: unknown): BrandAnalysisResult {
  if (typeof data !== 'object' || data === null) {
    throw new ValidationError('Response must be an object');
  }
  if (!('geoScore' in data)) {
    throw new ValidationError('Response missing geoScore field');
  }
  // TypeScript now knows data has geoScore, but we should still validate fully:
  return BrandAnalysisResultSchema.parse(data);  // Use Zod for runtime validation
}
```

### 2.2 — Never Use Non-Null Assertion (`!`)

The `!` operator tells TypeScript "this is definitely not null" and turns off null checking. If you're wrong, you get a cryptic runtime crash:

```typescript
// ❌ Bad — bypasses null safety:
const workspace = data.workspace!;
const userId = session.user!.id;

// ✅ Good — explicit null check with helpful error:
if (!data.workspace) {
  throw new NotFoundError('Workspace not found');
}
const workspace = data.workspace;  // TypeScript knows it's non-null here

// ✅ Also good — optional chaining for reads:
const userId = session?.user?.id;
if (!userId) throw new AuthError('Session is invalid');
```

**The only acceptable use of `!`:** When you have a ref in React that you KNOW is mounted:
```typescript
// Acceptable — inputRef.current is always set after mount:
function FocusInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current!.focus(); }, []);
}
```

### 2.3 — Prefer Explicit Return Types on Public Functions

TypeScript can infer return types, but explicit types serve as documentation and catch subtle mistakes:

```typescript
// ✅ Good — return type is contract documentation:
export async function extractSources(
  page: Page,
  provider: Provider
): Promise<AgentCitation[]> {
  // If you accidentally return a string here, TypeScript catches it immediately
  return [];
}

// ❌ Problematic — return type is inferred:
export async function extractSources(page: Page, provider: Provider) {
  // TypeScript infers Promise<AgentCitation[]> here — but if a refactor changes
  // the return to Promise<AgentCitation[] | null>, all callers silently get wrong types
  return [];
}
```

Rule: Always add explicit return types to exported functions and class methods. Internal implementation functions may omit them.

### 2.4 — Prefer `interface` over `type` for Object Shapes

Both work, but `interface` is preferred for object shapes because:
- It produces clearer error messages
- It can be extended with `extends`
- It's easier to augment (declaration merging)

```typescript
// ✅ Use interface for object shapes:
interface AgentConfig {
  entryUrl: string;
  warmupDelay: number;
  preAuthSetup?: (page: Page) => Promise<void>;
}

// ✅ Use type for unions, intersections, mapped types, computed types:
type Provider = 'openai' | 'anthropic' | 'perplexity' | 'google' | 'google-ai-overview';
type ProviderRecord<T> = Record<Provider, T>;
type Nullable<T> = T | null;
type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };
```

### 2.5 — Use `satisfies` for Config Objects

When you want TypeScript to validate an object against a type BUT still infer the most specific type:

```typescript
// Without satisfies — TypeScript widens the type:
const AGENT_CONFIGS: Record<Provider, AgentConfig> = { ... };
// AGENT_CONFIGS.openai.entryUrl is typed as string (wide)
// TypeScript won't autocomplete specific values

// With satisfies — TypeScript validates AND infers the specific type:
const AGENT_CONFIGS = {
  openai: { entryUrl: 'https://chatgpt.com/auth/login', warmupDelay: 2000 },
  anthropic: { entryUrl: 'https://claude.ai/new', warmupDelay: 2000 },
} satisfies Record<Provider, AgentConfig>;
// ✓ TypeScript validates all providers are present
// ✓ AGENT_CONFIGS.openai.entryUrl is 'https://chatgpt.com/auth/login' (literal type)
// ✓ If you add a new Provider to the union, TypeScript demands an entry here
```

### 2.6 — Use `as const` for Arrays and Objects That Should Not Change

```typescript
// Without as const — TypeScript infers string[]:
const PROVIDERS = ['openai', 'anthropic', 'perplexity'];
// PROVIDERS[0] is typed as string — could be any string

// With as const — TypeScript infers readonly ['openai', 'anthropic', 'perplexity']:
const PROVIDERS = ['openai', 'anthropic', 'perplexity'] as const;
// PROVIDERS[0] is typed as 'openai' — exact literal type
// TypeScript will error if you try to .push() or mutate it
```

---

## 3. File & Folder Structure Conventions

### 3.1 — Monorepo Package Structure

Each package follows this structure:

```
packages/utils/
├── src/
│   ├── index.ts          ← Barrel export (re-exports public API)
│   ├── format/
│   │   ├── date.ts
│   │   └── markdown.ts
│   ├── url/
│   │   ├── getDomain.ts
│   │   └── getUniqueLinks.ts
│   └── __tests__/
│       ├── url.test.ts
│       └── format.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Key rules:**
1. `src/index.ts` is the only file that `package.json#exports` points to — it's the public API
2. Everything exported from `index.ts` is part of the public contract and must maintain backward compatibility
3. Internal utilities NOT in `index.ts` can change freely
4. Tests live in `__tests__/` subdirectories, mirroring the source structure

### 3.2 — App Structure (Agent)

```
apps/agent/src/
├── api.ts             ← Express HTTP server entry point
├── worker.ts          ← BullMQ worker entry point
├── index.ts           ← Starts both api.ts and worker.ts, handles signals
├── env.ts             ← Zod environment validation
├── agents/
│   ├── lib/           ← Shared agent utilities (used by all providers)
│   │   ├── createAgent.ts
│   │   ├── extractSources.ts
│   │   ├── runAgents.ts
│   │   ├── runPrompts.ts
│   │   └── agentHandler.ts
│   ├── chatgpt/
│   │   └── auth/
│   │       └── validateAuth.ts
│   ├── claude/
│   │   └── auth/
│   │       └── validateAuth.ts
│   └── ...
├── config/
│   ├── providers.ts   ← AGENT_CONFIGS — single source of truth for provider config
│   └── selectors.ts   ← SELECTORS — all CSS selectors in one place
└── lib/
    ├── browser/       ← Browser management utilities
    │   ├── launchContext.ts
    │   ├── proxyPool.ts
    │   └── navigateWithRetry.ts
    ├── input/         ← DOM interaction utilities
    │   ├── askPrompt.ts
    │   └── extractAssistantMarkdown.ts
    └── auth/          ← Authentication utilities
        └── validateAuth.ts
```

---

## 4. Error Handling Standards

### 4.1 — Always Use Custom Error Classes

Never throw plain `Error` in production code. Custom error classes carry semantic meaning and allow callers to handle errors precisely:

```typescript
// ❌ Bad — gives no information about the error category:
throw new Error('Workspace not found');

// ✅ Good — uses the semantic error class:
throw new NotFoundError('Workspace not found', { workspaceId: id });

// ✅ Good — includes context in the meta field:
throw new AuthError('Session expired', {
  provider: 'openai',
  reason: 'cookie_expired',
  lastValidAt: sessionState.lastChecked,
});
```

### 4.2 — Never Swallow Errors Silently

```typescript
// ❌ Bad — error disappears:
try {
  await browser.close();
} catch { /* silent */ }

// ❌ Bad — error is logged but not acted on:
try {
  await browser.close();
} catch (err) {
  // This is marginally better but still looks like an accident:
}

// ✅ Good — explicit intent with logging:
try {
  await browser.close();
} catch (err) {
  // Browser cleanup failure is non-fatal (browser is likely already gone),
  // but we log it at warn level so it shows up in monitoring:
  logger.warn('[agent] Browser cleanup failed (non-fatal)', {
    error: err instanceof Error ? err.message : String(err),
    browserId: browser.wsEndpoint(),
  });
}
```

### 4.3 — Fail Fast on Startup

Validate all required configuration at startup, not at request time:

```typescript
// ✅ Good — fail at startup with a clear error:
// apps/agent/src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535),
  VPS_AUTH_PROFILE_PATH: z.string().startsWith('/'),
  API_AUTH_TOKEN: z.string().min(32),
  AGENT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
});

// Parse at module load time — if any var is missing, process exits before serving any requests:
export const env = EnvSchema.parse(process.env);
```

---

## 5. Async / Promise Patterns

### 5.1 — Always Use `async/await`, Never `.then()/.catch()` Chains

```typescript
// ❌ Bad — callback-style Promise chains are hard to read and debug:
fetchWorkspace(id)
  .then(workspace => workspace.members)
  .then(members => members.filter(m => m.role === 'owner'))
  .catch(err => console.error(err));

// ✅ Good — linear flow that reads like synchronous code:
try {
  const workspace = await fetchWorkspace(id);
  const owners = workspace.members.filter(m => m.role === 'owner');
} catch (err) {
  logger.error('Failed to fetch workspace', { workspaceId: id, error: err });
  throw err;  // Re-throw — don't swallow!
}
```

### 5.2 — Use `Promise.allSettled` for Independent Operations That Should All Complete

```typescript
// ❌ Bad — if browser[0] fails to close, browsers[1] and [2] never get closed:
await Promise.all([
  browser1.close(),
  browser2.close(),
  browser3.close(),
]);

// ✅ Good — all browsers get a close attempt regardless of failures:
const results = await Promise.allSettled([
  browser1.close(),
  browser2.close(),
  browser3.close(),
]);

const failures = results.filter(r => r.status === 'rejected');
if (failures.length > 0) {
  logger.warn(`${failures.length} browser(s) failed to close cleanly`);
}
```

### 5.3 — Use `Promise.all` for Independent Operations Where Any Failure Should Stop Everything

```typescript
// ✅ Good — if any migration fails, we don't want to proceed:
const [pgResult, clickhouseResult] = await Promise.all([
  runPostgresMigrations(),
  runClickHouseMigrations(),
]);
// If either throws, the overall await throws immediately
```

### 5.4 — Add Timeouts to External Calls

Never let external calls hang indefinitely:

```typescript
// ✅ Good — explicit timeout on Playwright navigation:
await page.goto(url, {
  waitUntil: 'domcontentloaded',
  timeout: 30_000,  // 30 seconds — fail fast if the site is down
});

// ✅ Good — explicit timeout on API calls:
const response = await fetch(proxyApiUrl, {
  signal: AbortSignal.timeout(10_000),  // 10 second timeout
});

// ✅ Good — explicit timeout on database queries:
const result = await db.query.workspaces.findMany({
  where: eq(workspaces.tenantId, orgId),
  // Add query timeout via the DB connection pool config
});
```

---

## 6. Environment & Configuration

### 6.1 — Centralize All Environment Validation

Never access `process.env` directly in business logic. Always go through the validated `env` object:

```typescript
// ❌ Bad — process.env can be undefined, unvalidated:
const redisHost = process.env.REDIS_HOST;     // Could be undefined!
const redisPort = parseInt(process.env.REDIS_PORT!);  // Could be NaN!

// ✅ Good — validated at startup, type-safe:
import { env } from './env';
const redisHost = env.REDIS_HOST;    // Guaranteed to be a string
const redisPort = env.REDIS_PORT;    // Guaranteed to be a number
```

### 6.2 — Document Every Environment Variable

Every variable in `.env.example` must have a comment explaining:
- What it's used for
- How to generate it (if it's a secret)
- Valid values (if it's an enum)
- Default value (if applicable)

---

## 7. Database Standards

### 7.1 — Never Write Raw SQL Strings in Application Code

Use Drizzle ORM's query builder for all PostgreSQL queries:

```typescript
// ❌ Bad — raw SQL: typos, SQL injection, no type safety:
const result = await db.execute(
  sql`SELECT * FROM workspaces WHERE tenant_id = ${tenantId} AND deleted_at IS NULL`
);

// ✅ Good — Drizzle query builder: type-safe, injection-safe, refactorable:
const result = await db.query.workspaces.findMany({
  where: and(
    eq(workspaces.tenantId, tenantId),
    isNull(workspaces.deletedAt)
  ),
  with: {
    members: true,
  },
});
```

**Exception:** ClickHouse complex analytical queries may require raw SQL via `clickhouse.query()` since Drizzle doesn't support ClickHouse. Document these queries with comments.

### 7.2 — Use Database Transactions for Multi-Step Mutations

```typescript
// ❌ Bad — if addMemberToWorkspace fails, the workspace was already created (inconsistent state):
const workspace = await createWorkspaceForTenant(data);
await addMemberToWorkspace({ workspaceId: workspace.id, userId: ownerId });

// ✅ Good — both succeed or both fail:
await db.transaction(async (tx) => {
  const workspace = await tx.insert(workspaces).values(workspaceData).returning();
  await tx.insert(workspaceMembers).values({ workspaceId: workspace[0].id, userId: ownerId });
});
```

### 7.3 — Soft Deletes Over Hard Deletes

For user-facing data (workspaces, prompts, members), prefer soft deletes using a `deletedAt` timestamp. This allows recovery and audit trailing:

```typescript
// ❌ Hard delete — data is gone forever:
await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));

// ✅ Soft delete — data is hidden but recoverable:
await db.update(workspaceMembers)
  .set({ deletedAt: new Date() })
  .where(eq(workspaceMembers.userId, userId));
```

---

## 8. API Design (tRPC)

### 8.1 — Procedure Naming

Use descriptive, domain-specific names — not generic HTTP verbs:

```typescript
// ❌ Bad — generic CRUD names that don't describe business meaning:
workspaceRouter.create()
workspaceRouter.delete()
workspaceRouter.update()

// ✅ Good — names describe the business action:
workspaceRouter.createForOrganization()    // Specific context
workspaceRouter.archiveWorkspace()         // "Archive" communicates soft-delete
workspaceRouter.updateProviderSettings()   // Specific what is updated
workspaceRouter.inviteMember()             // Business action, not CRUD
workspaceRouter.revokeAccess()             // Clear intent
```

### 8.2 — Input Validation with Zod

Every mutation must validate inputs. Every query must validate filter parameters:

```typescript
// ✅ Good — all inputs validated before business logic runs:
createWorkspace: protectedProcedure
  .input(z.object({
    name: z.string()
      .min(1, 'Workspace name cannot be empty')
      .max(100, 'Workspace name must be 100 characters or less')
      .trim(),
    country: z.string().length(2, 'Country must be a 2-letter ISO code'),
    region: z.string().max(100).nullable(),
    enabledProviders: z.array(z.enum(['openai', 'anthropic', 'perplexity', 'google', 'google-ai-overview']))
      .min(1, 'At least one provider must be enabled')
      .default(['openai', 'anthropic', 'perplexity']),
  }))
  .mutation(async ({ input, ctx }) => {
    // input is fully typed and validated at this point
    return createWorkspaceForTenant({ ...input, tenantId: ctx.org.id });
  }),
```

### 8.3 — Throw tRPC Errors, Not Custom Errors, in Procedures

Inside tRPC procedures, use `TRPCError` so the error is serialized correctly to the client:

```typescript
// ❌ Bad — NotFoundError won't serialize correctly to tRPC client:
if (!workspace) throw new NotFoundError('Workspace not found');

// ✅ Good — TRPCError is properly serialized:
if (!workspace) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Workspace not found',
  });
}
```

---

## 9. Browser Automation Standards

### 9.1 — Never Hardcode Selectors in Business Logic

All CSS selectors must live in `apps/agent/src/config/selectors.ts`:

```typescript
// ❌ Bad — selector buried in business logic, invisible to maintainers:
async function submitPrompt(page: Page, text: string) {
  const input = await page.$('#prompt-textarea');  // ← Selector is invisible from outside
  await input?.fill(text);
}

// ✅ Good — selector is centralized, named, findable:
import { SELECTORS } from '../../config/selectors';

async function submitPrompt(page: Page, provider: Provider, text: string) {
  const inputSelectors = SELECTORS[provider].chatInput;  // Array of fallback selectors
  const input = await findFirstMatching(page, inputSelectors);
  await input?.fill(text);
}
```

### 9.2 — Use Explicit Timeouts on All Waits

Never call `page.waitForTimeout(2000)` without a comment explaining WHY you're waiting:

```typescript
// ❌ Bad — why 2000ms? What are we waiting for?
await page.waitForTimeout(2000);

// ✅ Good — the wait is explained:
// Wait for the response streaming to begin — ChatGPT shows a "stop" button
// within ~1-2 seconds of the first token being generated:
await page.waitForTimeout(2000);

// ✅ Better — wait for a specific condition instead of a fixed time:
await page.waitForSelector('[data-testid="stop-button"]', { timeout: 5000 });
```

### 9.3 — Always Close Browsers in `finally` Blocks

```typescript
// ✅ Good — browser closes even if an error is thrown mid-prompt:
async function runAgentSession(payload: PromptPayload): Promise<AskPromptResult[]> {
  const { browser, context, page } = await createAgent(payload.provider);
  try {
    return await runPrompts(payload, page, payload.provider);
  } finally {
    // This runs whether runPrompts succeeded or threw an error:
    await browser.close().catch(err =>
      logger.warn('[agent] Browser close failed', { error: err.message })
    );
  }
}
```

---

## 10. Logging Standards

### 10.1 — Use Structured Logging, Never `console.log`

The codebase has a logger in `packages/errors/src/logger.ts`. Always use it:

```typescript
// ❌ Bad — unstructured, unsearchable, can't be filtered:
console.log('[agent] Job completed:', jobId);
console.error('[agent] Failed:', error);

// ✅ Good — structured, searchable, has severity level:
import { logger } from '@onescope/errors';

logger.info('[agent] Job completed', { jobId, provider, promptCount: results.length });
logger.error('[agent] Job failed', {
  jobId,
  provider,
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
});
```

### 10.2 — Log Levels

| Level | When to Use |
|-------|-------------|
| `logger.debug` | Very verbose output, only useful during development. Disable in production. |
| `logger.info` | Normal operation milestones: job started, job completed, auth succeeded |
| `logger.warn` | Something unexpected happened but the system recovered: browser close failed, proxy switched |
| `logger.error` | An operation failed and requires attention: job failed, auth expired, DB connection lost |

### 10.3 — Include Context in Every Log

```typescript
// ❌ Bad — tells you nothing useful:
logger.error('[agent] Failed');

// ✅ Good — enough context to debug without reading source code:
logger.error('[agent] Prompt extraction failed', {
  jobId: job.data.jobGroupId,
  provider: job.data.provider,
  promptIndex: currentPromptIndex,
  totalPrompts: prompts.length,
  errorType: error.constructor.name,
  errorMessage: error.message,
  retryAttempt: attempt,
  maxAttempts: MAX_PROMPT_RETRIES,
});
```

---

## 11. Git & Commit Standards

### 11.1 — Conventional Commits

Every commit message must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | A new feature | `feat(agent): add support for Meta AI provider` |
| `fix` | A bug fix | `fix(agent): correct regex double-escape in AI Overview extractor` |
| `refactor` | Code change that isn't a feature or fix | `refactor(agent): consolidate 5 agent factories into 1 generic factory` |
| `perf` | Performance improvement | `perf(db): add workspace_id to ClickHouse ORDER BY key` |
| `test` | Adding or updating tests | `test(utils): add URL deduplication edge case tests` |
| `docs` | Documentation only | `docs: add self-hosting guide` |
| `chore` | Build process, dependency updates | `chore: update Playwright from 1.57 to 1.58` |
| `ci` | CI/CD changes | `ci: add quality gate before Docker build` |
| `style` | Code formatting (no logic change) | `style: run Biome format on agent source` |

**Scopes** (use the package/app name):
- `agent` — `apps/agent`
- `web` — `apps/web`
- `db` — `packages/db`
- `services` — `packages/services`
- `types` — `packages/types`
- `utils` — `packages/utils`
- `errors` — `packages/errors`
- `docker` — Docker/deployment changes

**Examples:**

```bash
# ✅ Good commit messages:
feat(agent): add Google AI Overview agent for SERP visibility tracking
fix(web): prevent workspace members from removing the owner
refactor(agent): consolidate 5 source extractors into single config-driven extractor
perf(db): add workspace_id to ClickHouse ORDER BY key for 10x query speedup
test(services): add integration tests for workspace CRUD operations
docs: add step-by-step self-hosting guide with nginx + SSL config
fix(api): add path traversal validation to upload-sessions endpoint
ci: add TypeScript typecheck job before Docker image builds

# ❌ Bad commit messages:
fix bug
update files
stuff
wip
final version
FINAL FINAL version
cleanup
misc changes
```

### 11.2 — Branch Naming

```bash
# Format: type/short-description (kebab-case)

# ✅ Good:
feature/google-ai-overview-agent
fix/proxy-pool-exponential-decay
refactor/consolidate-agent-factories
docs/self-hosting-guide
chore/upgrade-playwright-1.58

# ❌ Bad:
my-branch
test
stuff
FEATURE
```

### 11.3 — Pull Request Size

Keep PRs focused. A PR should do ONE thing:

```
# ✅ Good PR scope:
"Consolidate 5 agent factories into 1 generic createAgent() function"
"Fix path traversal vulnerability in agent API"
"Add integration tests for workspace service"

# ❌ Bad PR scope:
"Refactor agents, fix security bugs, add tests, update docs, and improve performance"
→ This should be 5 separate PRs
```

---

## 12. Documentation Standards

### 12.1 — JSDoc for Public Functions

Every function exported from a package (`packages/*/src/index.ts`) must have a JSDoc comment:

```typescript
/**
 * Extracts all citations/sources from the current browser page for a given provider.
 *
 * The extraction strategy varies by provider (different DOM structures), but the
 * algorithm is identical: find the container, find links, extract titles and URLs,
 * deduplicate, return citations.
 *
 * @param page - The Playwright page object, after a prompt response has been received
 * @param provider - Which LLM provider's page we're currently on
 * @returns An array of deduplicated AgentCitation objects. Empty array if no sources found.
 *
 * @example
 * const page = await createChatGPTPage();
 * await submitPrompt(page, 'Tell me about TypeScript');
 * const sources = await extractSources(page, 'openai');
 * // sources: [{ url: 'https://...', title: 'TypeScript Docs', domain: 'typescriptlang.org' }]
 */
export async function extractSources(page: Page, provider: Provider): Promise<AgentCitation[]> {
```

### 12.2 — Inline Comments for Non-Obvious Logic

Comments should explain WHY, not WHAT (the code already shows what):

```typescript
// ❌ Bad — explains the code (we can read the code):
// Increment offset by batchSize
offset += batchSize;

// ✅ Good — explains why this is necessary:
// Advance the pagination offset. Without this, we'd re-analyze the same
// batch of responses in an infinite loop. The previous batch has now been
// marked as is_analysed = true, so the next query skips them.
offset += batchSize;

// ✅ Good — explains a non-obvious choice:
// We use Promise.allSettled (not Promise.all) here because we want ALL browsers
// to get a close attempt even if one fails. Using Promise.all would skip the
// remaining browsers if browser[0] throws during cleanup.
const results = await Promise.allSettled(activeBrowsers.map(b => b.close()));
```

---

## 13. Security Standards

### 13.1 — Input Validation Checklist

For every user-facing input:
- [ ] Validate type (is it a string/number/boolean?)
- [ ] Validate length/range (is it within expected bounds?)
- [ ] Validate format (is it a valid email, URL, ISO country code?)
- [ ] Validate allowed values (is it in the allowed set?)
- [ ] Sanitize HTML (strip `<script>` tags from any user content that will be rendered)

### 13.2 — Never Commit Secrets

Add to `.gitignore`:
```
# Environment files (contain secrets):
.env
.env.local
.env.production
apps/agent/.env

# Browser auth sessions (contain logged-in credentials):
storage/
apps/agent/storage/

# Analysis artifacts:
ANALYSIS.md
INFRASTRUCTURE.md
**/ANALYSIS.md
```

Set up a pre-commit hook to catch accidental secret commits:
```bash
# Install git-secrets:
brew install git-secrets  # macOS
# Configure patterns:
git secrets --add 'sk-[a-zA-Z0-9]{48}'           # OpenAI API keys
git secrets --add 'GOCSPX-[a-zA-Z0-9\-_]+'      # Google client secrets
git secrets --add 'BETTER_AUTH_SECRET=[^\s]+'    # Auth secrets
```

### 13.3 — Use Timing-Safe Comparisons for Secrets

```typescript
// ❌ Bad — vulnerable to timing attacks:
if (token === process.env.API_AUTH_TOKEN) { ... }

// ✅ Good — constant-time comparison:
import { timingSafeEqual } from 'crypto';

function isValidToken(token: string, expected: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;  // Length check must be outside timingSafeEqual
  return timingSafeEqual(a, b);
}
```

**Why timing attacks matter:** A naive string comparison (`===`) returns early as soon as it finds a mismatch. An attacker can measure how long comparison takes and infer partial matches — eventually guessing the secret one character at a time. `timingSafeEqual` always takes the same amount of time regardless of where the mismatch occurs.

---

## 14. Performance Standards

### 14.1 — Database Query Guidelines

- Always filter by indexed columns (`workspace_id`, `created_at`) first
- Never use `SELECT *` — select only the columns you need
- Use pagination (`LIMIT + OFFSET` or cursor-based) for large result sets — never fetch unbounded results
- Add `EXPLAIN ANALYZE` to queries that seem slow before optimizing

### 14.2 — Avoid N+1 Queries

```typescript
// ❌ Bad — N+1 query pattern: 1 query for workspaces, N queries for members:
const workspaces = await db.query.workspaces.findMany({ where: ... });
for (const workspace of workspaces) {
  workspace.members = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspace.id)
  });
}

// ✅ Good — single query with JOIN (Drizzle's 'with' clause):
const workspaces = await db.query.workspaces.findMany({
  where: ...,
  with: {
    members: {
      with: { user: true },
    },
  },
});
```

---

## 15. Open Source Standards (OSS)

### 15.1 — Required Files in the Repository Root

| File | Purpose |
|------|---------|
| `LICENSE` | Legal permission for others to use/modify/distribute the code |
| `README.md` | Project overview, quick start, key features |
| `CONTRIBUTING.md` | How to contribute code, issues, documentation |
| `CODE_OF_CONDUCT.md` | Community behavior standards |
| `.env.example` | All environment variables with descriptions (NO real values) |
| `.gitignore` | Files excluded from git (secrets, build artifacts) |
| `CHANGELOG.md` | History of notable changes per version |

### 15.2 — README Requirements

A good open-source README must have:

1. **Project name and one-line description** — appears in GitHub search
2. **Demo/screenshot** — first thing visitors see, should be impressive
3. **Features list** — bullet points of what the project can do
4. **Prerequisites** — Node version, required accounts (Google OAuth, OpenAI key, proxy service)
5. **Quick Start** — minimal commands to get a working instance in < 5 minutes
6. **Architecture overview** — one diagram + one paragraph
7. **Links** to detailed docs: SELF_HOSTING.md, CONTRIBUTING.md, etc.
8. **License badge** and **license name**

### 15.3 — GitHub Repository Settings

Configure for open-source:
- [ ] Enable Issues
- [ ] Enable Discussions (for community questions)
- [ ] Add topics/tags: `browser-automation`, `llm`, `monorepo`, `typescript`, `nextjs`, `playwright`
- [ ] Set up GitHub Pages for documentation (optional)
- [ ] Create Releases with semantic versioning tags
- [ ] Require PR review before merging to main
- [ ] Require status checks to pass (CI tests) before merging
- [ ] Enable Dependabot for automatic dependency updates

### 15.4 — Semantic Versioning

Tag releases with semantic versions (`v1.0.0`, `v1.1.0`, `v1.0.1`):

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (removing/renaming env vars, changing DB schema incompatibly)
MINOR: New features (adding a new provider, new dashboard feature)
PATCH: Bug fixes (fixing the regex bug, fixing path traversal)
```

Add a `CHANGELOG.md` entry for every release:
```markdown
## [1.1.0] - 2025-02-20

### Added
- Google AI Overview agent for SERP visibility tracking
- Self-hosting guide (docs/SELF_HOSTING.md)
- Automated backup script

### Fixed
- Regex double-escape bug in AI Overview date extractor
- Path traversal vulnerability in agent API session upload endpoint

### Changed
- Consolidated 5 agent factories into single generic `createAgent()` function
- Consolidated 5 source extractors into single config-driven `extractSources()` function
```

---

## 16. Code Review Standards

### 16.1 — What to Check in a PR

**As the reviewer:**
- [ ] Does the code solve the problem described in the PR?
- [ ] Does it follow all naming conventions in this document?
- [ ] Is every exported function documented with JSDoc?
- [ ] Are there tests for the new functionality?
- [ ] Are there any obvious security issues (unchecked inputs, missing auth)?
- [ ] Does it introduce any `any` types or `!` operators?
- [ ] Does `pnpm typecheck` pass?
- [ ] Does `pnpm lint` pass?

**As the author:**
- [ ] PR description explains WHY this change is needed, not just WHAT changed
- [ ] Each commit has a meaningful conventional commit message
- [ ] Tests cover the happy path AND at least one error path
- [ ] No debugging code (`console.log`, `debugger`) left in
- [ ] `.env.example` updated if new env vars were added
- [ ] CHANGELOG.md updated if this is a notable change

### 16.2 — Review Response Etiquette

- **Comment labels:** Use `nit:` for nitpicks (optional to fix), `question:` for curiosity, `blocker:` for required changes
- **Be specific:** "This could throw if `data.workspace` is undefined — add a null check on line 23" not "This could crash"
- **Explain the why:** "Use `Promise.allSettled` here because we want all browsers to be closed even if one fails — `Promise.all` would skip them" — link to this document if relevant
- **Approve with confidence:** Only approve if you would be comfortable explaining any part of the code in a future code review
