# package-types Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- None.

## New Improvements Missed Last Time
1. `packages/types/src/index.ts:1-8`
- Fix: split public stable exports from internal/experimental exports (separate entrypoints).
- Why: current broad barrel makes accidental API commitments.

2. `packages/types/src/types/agent.ts:36-45`
- Fix: keep `PROVIDER_LIST` as single source and enforce parity tests in consumers.
- Why: provider drift still occurs when consumers duplicate assumptions.

3. Cross-package runtime validation gap
- Fix: pair high-risk contracts with zod schemas in boundary packages (web/agent/services).
- Why: compile-time types do not validate runtime payloads.
