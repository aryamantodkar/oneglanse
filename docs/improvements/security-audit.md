# Security Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Claims referencing removed/relocated AI-overview execution paths are outdated.

## New Improvements Missed Last Time

3. `packages/utils/src/format/formatMarkdown.ts:10`
- Fix: enforce sanitization boundary before any `dangerouslySetInnerHTML` rendering path.
- Why: XSS risk.

4. `apps/agent/src/lib/utils/runStep.ts:17-33`
- Fix: rethrow after diagnostics.
- Why: swallowing critical failures can create inconsistent security states.

5. `apps/web/src/env.js:9-33`
- Fix: validate all security-critical environment variables.
- Why: fail-fast startup prevents unsafe defaults.
