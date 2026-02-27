# Production Checklist (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- "web container bind issue unresolved" is now fixed with compose env.
  - Evidence: `docker-compose.yml:132-134` includes `HOSTNAME=0.0.0.0`, `PORT=3000`.

## New Improvements Missed Last Time
- [ ] `apps/agent/src/lib/utils/runStep.ts:17-33`
  - Fix: rethrow after diagnostics.
  - Why: prevent silent step failure.

- [ ] `apps/agent/src/agents/core/createAgent.ts:29-30`
  - Fix: finite default timeouts.
  - Why: avoid indefinite hung operations.

- [ ] `apps/web/middleware.ts:9`
  - Fix: remove session log.
  - Why: PII safety.

- [ ] `packages/services/src/prompt/index.ts:126-144`
  - Fix: remove interpolated scheduled SQL payload secrets and identifiers.
  - Why: query safety + secret hygiene.

- [ ] `packages/services/src/agent/redis.ts:6`
  - Fix: use `REDIS_PORT` env.
  - Why: deploy portability.

- [ ] `.github/workflows/docker-build.yml:40`
  - Fix: re-enable lint gate.
  - Why: quality enforcement.
