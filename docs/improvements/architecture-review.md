# Architecture Review (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Claim that `google-ai-overview` bypasses shared provider flow is outdated.
- Claim that UI package has active self-import cycles is outdated.

## New Improvements Missed Last Time
1. `apps/agent/src/lib/browser/launch.ts:10-84` and `apps/agent/src/lib/browser/cdp.ts:1-72`
- Fix: deduplicate CDP lifecycle helpers by using only `lib/browser/cdp.ts` as source of truth.
- Why: CDP logic is now central; duplicate launch variants will drift.

2. `apps/agent/src/worker/jobHandler.ts:66-96, 143-159`
- Fix: replace read-modify-write Redis progress updates with atomic Lua/CAS or hash fields.
- Why: concurrent provider jobs can overwrite each other's progress.

3. `apps/agent/src/agents/core/runPrompts.ts:224-235`
- Fix: make provider reset policy pluggable in provider config (not hardcoded in loop).
- Why: behavior currently embeds provider-specific state reset inside core engine.

4. `apps/web/src/server/api/middleware/timingMiddleware.ts:8-11`
- Fix: remove random dev latency injection from middleware.
- Why: this distorts latency signals and masks true performance characteristics.

## Architecture Target
- Keep provider-specific logic in `providerRegistry` hooks.
- Keep orchestration generic in `agentHandler`/`runPrompts`.
- Keep infra concerns (CDP spawn/connect/cleanup) in `lib/browser/*` only.
