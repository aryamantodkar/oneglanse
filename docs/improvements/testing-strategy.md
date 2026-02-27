# Testing Strategy (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- None.

## New Improvements Missed Last Time
1. Add regression tests for AI-overview submission flow
- Target: `apps/agent/src/agents/core/steps/askPrompt.ts` and `submitStrategies.ts`
- Cases: URL query navigation path, submit timeouts, and no send-button behavior.

2. Add orchestration safety tests
- Target: `apps/agent/src/lib/utils/runStep.ts` and `worker/jobHandler.ts`
- Cases: step failure propagation and Redis progress race behavior.

3. Add security boundary tests
- Target: `apps/web/middleware.ts`, `packages/utils/src/format/formatMarkdown.ts`
- Cases: no session logging, sanitization contract enforcement.

## Minimal CI Test Gate
- Unit tests for `packages/services` SQL safety and `packages/errors` classification.
- Agent integration test for one provider cycle with forced failure path.
- Web integration test for authenticated middleware behavior.
