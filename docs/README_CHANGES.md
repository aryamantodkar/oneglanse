# OneScope Changes README

This document summarizes the major changes made in the recent hardening/refactor pass across the monorepo.

## Scope
- Provider execution flow alignment
- Google AI Overview reliability fixes
- Browser/CDP launch hardening
- Submission timeout and state-reset behavior
- Deployment stability fixes
- Improvement docs refresh

## 1. Provider Flow Alignment
### What changed
- Removed the special `google-ai-overview` execution branch from worker handling.
- Routed `google-ai-overview` through the same shared provider pipeline as other providers.

### Why
- Keeps retry/error/proxy behavior consistent across providers.
- Reduces one-off logic and drift.

## 2. Google AI Overview Reliability
### What changed
- AI Overview prompt submission now uses direct Google search URL navigation (`/search?q=...`) for this provider.
- Added provider-specific handling to avoid chat-style submit assumptions.
- Added/updated logic to reset page state between AI Overview prompts to prevent stale query contamination.
- Added explicit wait logic for AI Overview container before extraction.
- Hardened extraction to support fallback DOM variants (not only one container shape).

### Why
- Google Search behavior is navigation-based, not chat-send-button based.
- Previous approach could stall at submit or extract too early.

## 3. Submission Safety
### What changed
- Added per-submit-method timeout controls.
- Added global submission-phase timeout for all providers.
- Added provider-specific success signal for AI Overview based on URL query state.

### Why
- Prevents indefinite hangs at submission.
- Makes failures deterministic and retryable.

## 4. Browser/CDP Hardening
### What changed
- Unified shared browser launch to CDP self-spawned Chromium strategy.
- Added robust cleanup path for spawned processes and temp profiles.
- Propagated cleanup through shared agent lifecycle.

### Why
- Reduces automation fingerprinting risk.
- Prevents orphaned browser processes and resource leaks.

## 5. Selector/Editor Fixes
### What changed
- Removed invalid AI Overview editor selector (`[role="search"]`) that matched a non-editable wrapper.
- Prioritized real Google query input selectors.
- Updated provider-scoped editor detection usage.

### Why
- Eliminates repeated “found input” loops that never became editable.

## 6. Docker/Deployment Stability
### What changed
- Added explicit web container bind env in compose:
  - `HOSTNAME=0.0.0.0`
  - `PORT=3000`

### Why
- Fixes intermittent host accessibility issues where app appeared healthy but reset external connections.

## 7. Documentation Refresh
### What changed
- Refreshed all files under `docs/improvements/` and `docs/MONOREPO_IMPROVEMENTS.md`.
- Removed stale findings that are no longer true.
- Added newly discovered gaps with exact file/line fix targets.

### Updated docs
- `docs/MONOREPO_IMPROVEMENTS.md`
- `docs/improvements/monorepo-overview.md`
- `docs/improvements/architecture-review.md`
- `docs/improvements/apps-agent.md`
- `docs/improvements/apps-web.md`
- `docs/improvements/package-db.md`
- `docs/improvements/package-errors.md`
- `docs/improvements/package-services.md`
- `docs/improvements/package-types.md`
- `docs/improvements/package-ui.md`
- `docs/improvements/package-utils.md`
- `docs/improvements/dependency-audit.md`
- `docs/improvements/security-audit.md`
- `docs/improvements/testing-strategy.md`
- `docs/improvements/production-checklist.md`

## 8. Operational Notes
- `google-ai-overview` now behaves like other providers in orchestration, but retains provider-specific query/extraction behavior where needed.
- If you keep `apps/agent/src/agents/google/ai-overview/lib/cdpSearch.ts`, treat it as reference/legacy unless you explicitly rewire it.

## 9. Recommended Validation Before Launch
Run:
1. `pnpm -C apps/agent typecheck`
2. `pnpm -C apps/web typecheck`
3. `pnpm typecheck`
4. `docker compose up -d --force-recreate web`
5. `curl -I http://127.0.0.1:3000`

## 10. Remaining High-Priority Follow-ups
- Re-throw in `apps/agent/src/lib/utils/runStep.ts` after diagnostics.
- Remove infinite Playwright timeouts in `apps/agent/src/agents/core/createAgent.ts`.
- Remove session logging from `apps/web/middleware.ts`.
- Eliminate deep import in `apps/web/src/lib/auth/auth.ts`.
- Parameterize/remodel scheduler SQL payload in `packages/services/src/prompt/index.ts`.
- Re-enable lint and modernize CI triggers in `.github/workflows/docker-build.yml`.

