# Architecture Review (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Claim that `google-ai-overview` bypasses shared provider flow is outdated.
- Claim that UI package has active self-import cycles is outdated.

## New Improvements Missed Last Time
1. `apps/agent/src/lib/browser/launch.ts:10-84` and `apps/agent/src/lib/browser/cdp.ts:1-72`
- Fix: deduplicate CDP lifecycle helpers by using only `lib/browser/cdp.ts` as source of truth.
- Why: CDP logic is now central; duplicate launch variants will drift.

3. `apps/agent/src/agents/core/runPrompts.ts:224-235`
- Fix: make provider reset policy pluggable in provider config (not hardcoded in loop).
- Why: behavior currently embeds provider-specific state reset inside core engine.

## Architecture Target
- Keep provider-specific logic in `providerRegistry` hooks.
- Keep orchestration generic in `agentHandler`/`runPrompts`.
- Keep infra concerns (CDP spawn/connect/cleanup) in `lib/browser/*` only.
