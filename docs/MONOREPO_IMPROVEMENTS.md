# Monorepo Improvements (Current Plan, 2026-02-27)

This file replaces stale broad recommendations with current, verified priorities.

2. `apps/agent/src/agents/core/createAgent.ts:29-30`
- Fix: finite default page and navigation timeouts.
- Why: avoids stuck workers.