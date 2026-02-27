# package-utils Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- "missing semicolon in `packages/utils/src/agent/index.ts`" is no longer relevant.

## New Improvements Missed Last Time
1. `packages/utils/src/index.ts:6` + `packages/utils/src/metrics/index.ts:1-2`
- Fix: remove `metrics` re-export until a real module exists.
- Why: placeholder exports create dead public surface.

2. `packages/utils/src/format/formatMarkdown.ts:10`
- Fix: return sanitized HTML or rename function to `formatMarkdownUnsafe` and enforce sanitizer at call sites.
- Why: current output is raw parsed HTML.

3. `packages/utils/src/agent/constants.ts:40-90`
- Fix: break giant selector arrays into provider-specific modules and add selector liveness tests.
- Why: selector drift is high-risk and hard to review in one monolithic file.
