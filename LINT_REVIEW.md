# Lint Review

Full-repo Biome scan — 187 errors remaining after all safe auto-fixes have been applied.

Issues left here require manual review because:
- **`noExplicitAny`** — needs proper TypeScript types; wrong types silently break runtime behaviour
- **`noNonNullAssertion`** — Biome's auto-fix replaces `!` with `?.` which is **NOT equivalent**: `!` throws on null, `?.` silently returns undefined
- **`noAssignInExpressions`** — assignment inside a condition; may be intentional or an accidental `=` instead of `===`
- **`noArrayIndexKey`** — React `key={index}` antipattern; fixing requires a stable unique ID from the data
- **`useExhaustiveDependencies`** — React `useEffect`/`useMemo` missing deps; adding wrong deps causes infinite loops
- **`useValidAnchor`** — `<a>` elements without valid `href`; fix depends on whether element should be `<button>` instead
- **`useButtonType`** — `<button>` missing `type` attribute; fix is to add `type="button"` or `type="submit"` depending on intent
- **`useKeyWithClickEvents`** — interactive elements missing keyboard handlers; requires intent review
- **`noSvgWithoutTitle`** — SVG missing accessible title; fix requires adding a `<title>` element
- **`noLabelWithoutControl`** — `<label>` not associated with an input; fix requires `htmlFor` or wrapping
- **`noImplicitAnyLet`** — `let` variable inferred as `any`; needs an explicit type
- **`noDangerouslySetInnerHtml`** — ⚠️ SECURITY: HTML injection risk; requires sanitisation review

**Safe auto-fixable issues (`--fix --unsafe`):**
`noUnusedTemplateLiteral` (11), `useNodejsImportProtocol` (7), `noUselessElse` (4), `useOptionalChain` (2), `useSelfClosingElements` (1) — run `pnpm exec biome check --fix --unsafe` on a per-file basis after reviewing each change.

---

## ⚠️ SECURITY — Fix First

### `noDangerouslySetInnerHtml` — HTML injection risk

Using `dangerouslySetInnerHTML` without sanitisation allows XSS if the content ever comes from user input or an external source.

| File | Line | Context |
|------|------|---------|
| `apps/web/src/app/(auth)/prompts/page.tsx` | ~1194 | raw HTML injected via `dangerouslySetInnerHTML` |

**Fix:** Wrap the content with a sanitiser (e.g. `DOMPurify.sanitize(html)`) before passing to `dangerouslySetInnerHTML`, or replace with a safe renderer.

---

## Agent (`apps/agent/src`)

### `noExplicitAny` — replace with proper types

| File | Context |
|------|---------|
| `agents/google/ai-overview/lib/extractResponse.ts` | `catch (error: any)` |
| `agents/google/ai-overview/lib/extractSources.ts` | interface field typed as `any`; `catch` block |
| `agents/lib/agentHandler.ts` | factory return type `Promise<any>`; multiple `catch (err: any)` |
| `agents/lib/runPrompts.ts` | function param typed as `any`; multiple `catch (err: any)` |
| `agents/lib/steps/askPrompt.ts` | multiple `catch (err: any)` |
| `api.ts` | `catch (err: any)` |
| `auth/upload-session.ts` | `SessionData` interface — multiple fields typed as `any` (8 occurrences) |
| `lib/browser/launchContext.ts` | `catch (err: any)` |
| `lib/browser/navigateWithRetry.ts` | `catch (err: any)` |
| `lib/browser/proxyPool.ts` | `catch (err: any)` |
| `lib/browser/pageHealthCheck.ts` | `catch (err: any)` |
| `lib/utils/logger.ts` | 6 occurrences — log method params typed as `any` |
| `lib/utils/writePromptsToFile.ts` | param typed as `any` |
| `auth/login.ts` | typed as `any` |
| `worker.ts` | 3 occurrences |

**Recommended fix for catch blocks:** `catch (err: unknown)` → narrow with `err instanceof Error ? err.message : String(err)`.

---

### `noNonNullAssertion` — verify before replacing `!` with `?.`

> ⚠️ Do NOT auto-fix. `x!.prop` throws if x is null; `x?.prop` silently returns `undefined`.

| File | Context |
|------|---------|
| `lib/browser/proxyPool.ts` | 4 non-null assertions on array/map lookups |
| `lib/input/extractAssistantMarkdown.ts` | 1 non-null assertion |

---

## Web App (`apps/web/src`)

### `noExplicitAny` — replace with proper types

| File | Context |
|------|---------|
| `app/(auth)/dashboard/_components/competitive-landscape.tsx` | typed as `any` |
| `app/(auth)/dashboard/_hooks/use-dashboard-data.ts` | 3 occurrences — hook state or param |
| `app/(auth)/dashboard/page.tsx` | 3 occurrences |
| `app/(auth)/onboarding/page.tsx` | 3 occurrences |
| `app/(auth)/workspace/page.tsx` | 2 occurrences |
| `app/(auth)/workspace/new/page.tsx` | 1 occurrence |
| `app/(auth)/prompts/page.tsx` | 2 occurrences |
| `app/(auth)/people/page.tsx` | 20 occurrences |
| `components/dialogs/join-workspace-dialog.tsx` | 2 occurrences |
| `components/app-sidebar.tsx` | 2 occurrences |
| `components/location/locationSelector.tsx` | 1 occurrence |
| `server/api/routers/workspace/workspace.ts` | 3 occurrences |

---

### `noNonNullAssertion` — verify before replacing `!` with `?.`

> ⚠️ Do NOT auto-fix. Each needs manual confirmation that the value is always non-null at that point.

| File | Context |
|------|---------|
| `app/(auth)/dashboard/_components/brand-comparison-chart.tsx` | 7 assertions — array index lookups on `SERIES_COLORS[idx]!` and `METRIC_CONFIG[pointIdx]!`; safe because loop bounds are fixed |
| `app/(auth)/dashboard/_hooks/use-dashboard-data.ts` | 8 assertions on computed values and map lookups |
| `app/(auth)/prompts/page.tsx` | non-null assertions |
| `lib/workspace/joinCode.ts` | 2 assertions |
| `server/api/routers/agent/agent.ts` | 4 assertions |
| `server/api/routers/prompt/prompt.ts` | 7 assertions |
| `server/api/routers/workspace/workspace.ts` | 1 assertion |

---

### `noAssignInExpressions` — potential logic bug

Assignment inside a condition. Could be intentional (common JS idiom) or an accidental `=` instead of `===`.

| File | Review |
|------|--------|
| `app/(auth)/dashboard/_components/competitive-landscape.tsx` | check if `=` should be `===` |
| `app/(auth)/dashboard/_components/filters.tsx` | check if `=` should be `===` |

---

### `noArrayIndexKey` — unstable React keys

Using array index as `key` prop causes incorrect reconciliation when items are reordered or removed.

| File | Fix |
|------|-----|
| `app/(auth)/dashboard/_components/states.tsx` | use a stable unique ID from the data |
| `app/(auth)/loading.tsx` | use a stable unique ID from the data |
| `app/(auth)/schedule/page.tsx` | 2 occurrences — use stable IDs |
| `app/(auth)/people/page.tsx` | use stable ID from the data |
| `app/(auth)/sources/page.tsx` | use stable ID from the data |

---

### `useExhaustiveDependencies` — missing React hook dependencies

| File | Review |
|------|--------|
| `app/(auth)/layoutContent.tsx` | value used inside `useEffect`/`useMemo` missing from deps array — memoize the dependency first if it's a new object on every render |
| `components/location/locationSelector.tsx` | 4 occurrences — missing deps in hooks |

---

### `useValidAnchor` — `<a>` without valid `href`

`<a>` tags used as buttons (no `href`, or `href="#"`). Should use `<button>` or have a real `href`.

| File | Context |
|------|---------|
| `app/login/page.tsx` | anchor used as interactive element |
| `app/signup/page.tsx` | anchor used as interactive element |
| `components/forms/login-form.tsx` | 3 occurrences |
| `components/forms/signup-form.tsx` | 3 occurrences |

**Fix:** Replace with `<button type="button">` where there's no navigation intent, or add a real `href`.

---

### `useButtonType` — `<button>` missing `type` attribute

Buttons without `type` default to `type="submit"` inside a `<form>`, which can cause accidental form submissions.

| File | Context |
|------|---------|
| `app/(auth)/schedule/page.tsx` | 1 occurrence |
| `app/(auth)/prompts/page.tsx` | 3 occurrences |
| `app/(auth)/sources/page.tsx` | 3 occurrences |

**Fix:** Add `type="button"` to non-submit buttons, `type="submit"` to submit buttons.

---

### `useKeyWithClickEvents` — missing keyboard handler

Interactive `<div>`/`<span>` elements with `onClick` must also handle `onKeyDown`/`onKeyUp` for keyboard accessibility.

| File | Context |
|------|---------|
| `app/(auth)/prompts/page.tsx` | 2 occurrences |

**Fix:** Add `onKeyDown={(e) => e.key === 'Enter' && handler()}` or replace with a `<button>`.

---

### `noSvgWithoutTitle` — SVG missing accessible title

Screen readers cannot describe the SVG without a `<title>` element.

| File | Context |
|------|---------|
| `app/(auth)/dashboard/_components/brand-comparison-chart.tsx` | inline SVG chart |
| `components/forms/signup-form.tsx` | decorative or icon SVG |

**Fix:** Add `<title>Description</title>` as the first child, or add `aria-hidden="true"` if purely decorative.

---

### `noLabelWithoutControl` — `<label>` not associated with input

| File | Context |
|------|---------|
| `components/location/locationSelector.tsx` | 2 occurrences — `<label>` elements not linked to an input via `htmlFor` or wrapping |

**Fix:** Add `htmlFor="input-id"` to the label and `id="input-id"` to the input, or wrap the input inside the `<label>`.

---

### Fixable with `--fix --unsafe` (review changes before committing)

These are safe in intent but Biome classifies them as "unsafe" fixes. Review each diff before applying.

| Rule | Count | Files |
|------|-------|-------|
| `noUnusedTemplateLiteral` | 11 | `app/(auth)/schedule/page.tsx` (8×), `packages/services/src/prompt/index.ts` (3×) |
| `useNodejsImportProtocol` | 7 | `apps/web/next.config.js`, `server/api/middleware/isInternal.ts`, `server/api/routers/agent/agent.ts`, `server/api/routers/location/location.ts` (2×), `server/api/routers/internal/internal.ts`, `server/api/routers/workspace/workspace.ts` |
| `noUselessElse` | 4 | `app/(auth)/schedule/page.tsx` (4×) |
| `useOptionalChain` | 2 | `server/api/routers/workspace/workspace.ts` (2×) |
| `useSelfClosingElements` | 1 | `app/(auth)/prompts/page.tsx` |

Run per-file: `pnpm exec biome check --fix --unsafe <file>` and review the diff.

---

## Packages

### `noExplicitAny` — replace with proper types

| File | Context |
|------|---------|
| `packages/services/src/prompt/index.ts` | 3 occurrences |
| `packages/services/src/analysis/analysis.ts` | 2 occurrences |
| `packages/errors/src/errorHandling.ts` | 1 occurrence |

---

### `noNonNullAssertion` — verify before replacing

| File | Context |
|------|---------|
| `packages/utils/src/extract/extractSourceStats.ts` | `sourcesByModel.get(model)!.push(source)` — safe: key is set two lines above, but Biome can't see that |
| `packages/utils/src/extract/extractDomainStats.ts` | `modelMap.get(model)!` — same pattern, key set in block above |
| `packages/services/src/workspace/index.ts` | 1 assertion |
| `packages/db/drizzle.config.ts` | 1 assertion |

---

### `noImplicitAnyLet` — `let` inferred as `any`

| File | Context |
|------|---------|
| `packages/services/src/analysis/runAnalysis.ts` | `let` variable without type annotation inferred as `any` |

**Fix:** Add an explicit type annotation to the `let` declaration.

---

## UI Package (`packages/ui/src`)

### `useExhaustiveDependencies` — missing React hook dependency

| File | Context |
|------|---------|
| `packages/ui/src/components/sidebar.tsx` | 2 occurrences — missing deps in hooks; memoize before adding |
