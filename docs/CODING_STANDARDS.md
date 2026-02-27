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