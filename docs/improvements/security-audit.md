# Security Audit

## Severity Legend
- P0: immediate exploit path or sensitive data exposure.
- P1: high-confidence security weakness likely to fail in production.
- P2: security hardening gap.

## P0 Findings

### P0-1: SQL Injection/Unsafe SQL Construction in Scheduler Payload
- File: `packages/services/src/prompt/index.ts`
- Issue: `scheduleCronForPrompts` builds SQL payload by interpolating `workspaceId`, `userId`, `API_BASE_URL`, and `INTERNAL_CRON_SECRET` into SQL text.
- Risk: quote-breaking and payload manipulation in SQL string construction.
- Minimal fix:
  - Replace interpolated payload with parameterized SQL and validated inputs.
  - Reject non-URL `API_BASE_URL` and invalid cron schedule format.
- Long-term fix:
  - Move cron dispatch to a dedicated scheduler service with typed request body and DB-side parameter bindings only.

### P0-2: Raw HTML Rendering Path Without Explicit Sanitization
- Files:
  - `apps/web/src/app/(auth)/prompts/page.tsx`
  - `packages/utils/src/format/formatMarkdown.ts`
- Issue: `formatMarkdown` uses `marked.parse` and output is injected with `dangerouslySetInnerHTML`.
- Risk: stored XSS if model output or stored response contains malicious HTML/scriptable payloads.
- Minimal fix:
  - sanitize rendered HTML with a strict sanitizer before render.
  - block raw HTML tags in markdown parser config.
- Long-term fix:
  - render markdown via safe AST component pipeline (no raw HTML rendering path).

### P0-3: Session Data Logged in Middleware
- File: `apps/web/middleware.ts`
- Issue: logs full session object with `console.log("Session in middleware:", session)`.
- Risk: PII leakage in logs and log aggregation systems.
- Minimal fix: remove this log line immediately.
- Long-term fix: redacted structured logging policy enforced by lint rule.

## P1 Findings

### P1-1: Agent Upload Endpoint Missing Schema Validation and Rate Limiting
- File: `apps/agent/src/api.ts`
- Issue: JSON parsed manually; no zod/schema validation; no rate limiting; no request timeout.
- Risk: malformed payload abuse, noisy brute-force attempts, and service degradation.
- Minimal fix:
  - add payload schema validation and explicit request timeout.
  - add token/IP rate limiting for `/upload-sessions`.
- Long-term fix:
  - migrate to typed HTTP framework middleware stack with centralized auth, size, timeout, and limiter policies.

### P1-2: Direct Package Source Imports Bypass Public Contracts
- Files:
  - `apps/web/src/lib/auth/auth.ts`
  - `apps/agent/tsconfig.json`
- Issue: app code reaches package internals (`packages/*/src/*`).
- Risk: accidental exposure and unstable internal APIs becoming implicit public surface.
- Minimal fix: import only from package entrypoints.
- Long-term fix: enforce import boundary rules in CI.

### P1-3: Inconsistent Constant-Time Auth Usage
- File: `apps/agent/src/api.ts`
- Issue: token compare is constant-time only when lengths match; length mismatch exits early.
- Risk: small timing side-channel.
- Minimal fix: compare fixed-length digests instead of raw token strings.
- Long-term fix: use battle-tested auth middleware/token verifier.

### P1-4: Incomplete Environment Validation for Security-Critical Vars
- Files:
  - `apps/web/src/env.js`
  - `apps/web/src/server/api/middleware/isInternal.ts`
  - `packages/services/src/prompt/index.ts`
- Issue: many critical vars (`INTERNAL_CRON_SECRET`, `API_BASE_URL`, auth secrets) are used without centralized schema validation.
- Risk: silent misconfiguration and unsafe fallback behavior.
- Minimal fix: validate all security-critical env vars at startup.
- Long-term fix: package-specific typed config modules with required/optional policies.

## P2 Findings

### P2-1: Tracked Runtime/Infra Artifacts in Repo
- Files:
  - `apps/agent/proxies.txt`
  - `apps/web/src/app/(auth)/dashboard/page.tsx.bak`
- Issue: tracked runtime-style files increase accidental leakage and attack surface.
- Minimal fix: replace with example files and enforce ignore patterns.
- Long-term fix: pre-commit checks for secret/runtime artifacts.

### P2-2: Logging Inconsistency Reduces Incident Quality
- Files:
  - `packages/services/src/agent/redis.ts`
  - `apps/agent/src/lib/utils/runStep.ts`
  - multiple web components with `console.log`
- Issue: mixed logging formats and no request/job correlation IDs.
- Risk: delayed incident response and weak forensic traceability.
- Minimal fix: unify on one logger API and include job/workspace IDs.
- Long-term fix: structured logs + distributed trace IDs.

### P2-3: No Security CI Controls
- File: `.github/workflows/docker-build.yml`
- Issue: no dependency vulnerability scan, no secrets scan, no SAST.
- Minimal fix: add `pnpm audit --prod`, secret scan, and basic SAST step.
- Long-term fix: scheduled security workflows + SARIF reporting + policy gates.

## OSS Security Readiness Verdict
- Not ready for open-source production usage without P0/P1 fixes.
- Top release blockers are SQL string construction, unsanitized HTML rendering path, and weak endpoint hardening.

## 🔥 Critical — Must Fix Before Open Source
- Parameterize scheduler SQL and remove string interpolation of secrets/IDs.
- Sanitize markdown HTML output before `dangerouslySetInnerHTML`.
- Remove middleware session logging.
- Add schema validation + rate limiting + timeouts to agent upload endpoint.

## ⚡ High Priority — Fix This Week
- Enforce package boundary imports through lint/CI rules.
- Add full env validation for security-critical variables.
- Add baseline security scans to CI.

## 🟡 Medium Priority — Improve Soon
- Standardize structured logging with correlation IDs.
- Harden auth token comparison to digest-based constant-time checks.
- Remove tracked runtime artifacts and tighten `.gitignore`.

## 💤 Later Improvements
- Add threat model documentation per app.
- Add periodic dependency and secrets drift monitoring.
