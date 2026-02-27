# apps/agent Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- "google-ai-overview has separate job handler path" is no longer true.
- "CDP launch only exists in AI overview code" is no longer true.

## New Improvements Missed Last Time
1. `apps/agent/src/lib/utils/runStep.ts:17-33`
- Fix: rethrow caught errors after screenshot/URL diagnostics.
- Why: current swallow pattern causes false-success execution.

2. `apps/agent/src/agents/core/createAgent.ts:29-30`
- Fix: set non-zero defaults from env (example: 30s/60s).
- Why: prevents indefinite page hangs.

3. `apps/agent/src/agents/google/ai-overview/lib/cdpSearch.ts:1-255`
- Fix: either remove file or rewire it into shared pipeline diagnostics path.
- Why: currently dead code increases maintenance cost and confuses contributors.

4. `apps/agent/src/lib/browser/launch.ts:41-55`
- Fix: add cleanup telemetry (duration, kill fallback used).
- Why: process cleanup is critical and currently opaque in production incidents.

5. `apps/agent/src/worker/jobHandler.ts:66-96`
- Fix: make Redis progress updates atomic.
- Why: provider jobs can race and regress UI progress state.

6. `apps/agent/src/lib/utils/logger.ts` (varargs `any` surface)
- Fix: narrow logger API to `unknown[]` + structured metadata overloads.
- Why: reduces untyped logging and improves machine parsing.

## Suggested Patch Order
1. `runStep` rethrow
2. page timeout policy
3. atomic progress updates
4. dead-code removal (`cdpSearch.ts`)
