# package-ui Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- `packages/ui/src/components/sidebar.tsx` self-import issue is resolved.

## New Improvements Missed Last Time
1. `packages/ui/src/index.ts:1-62`
- Fix: split exports into stable public API and internal-only entrypoint.
- Why: broad barrel increases accidental breaking-change surface.

2. `packages/ui/src/components/sidebar.tsx:84`
- Fix: set cookie attributes (`SameSite=Lax; Secure` when https) when writing sidebar cookie.
- Why: strengthens client-side state cookie hygiene.

3. Missing package-level tests
- Fix: add unit tests for keyboard toggle and mobile sidebar state.
- Why: sidebar is behavior-heavy and central to UX shell.
