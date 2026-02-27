# package-errors Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Reference to `packages/errors/src/errorHandling.ts` is outdated (file does not exist).

## New Improvements Missed Last Time
1. `packages/errors/src/lib/classifyError.ts:6`
- Fix: avoid `(err as any)`; use typed guard (`instanceof Error`) + fallback extraction.
- Why: `any` weakens correctness and can hide non-standard error shapes.

2. `packages/errors/src/lib/classifyError.ts:8-26`
- Fix: externalize regex map into tested constants and add table-driven tests.
- Why: classification drift is likely as providers evolve.

3. `packages/errors/src/lib/classifyError.ts`
- Fix: include an explicit `unknown_error` code for non-matching cases instead of generic `unknown` if consumer semantics need it.
- Why: improves analytics and retry policy clarity.
