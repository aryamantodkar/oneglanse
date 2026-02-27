# apps/web Audit (Refreshed 2026-02-27)

## No Longer Valid (Removed)
- Generic claim that all auth/session logging issues were resolved is not valid.

## New Improvements Missed Last Time
1. `apps/web/middleware.ts:9`
- Fix: remove `console.log("Session in middleware:", session)`.
- Why: leaks session/PII into logs.

2. `apps/web/src/server/api/middleware/timingMiddleware.ts:8-11,16`
- Fix: remove random delay + replace console logging with structured logger.
- Why: synthetic latency and unstructured logs hurt observability.

3. `apps/web/src/env.js:9-15`
- Fix: validate full runtime env set (auth, redis, internal secret, API base URL, oauth keys).
- Why: current schema validates only `DATABASE_URL` and `NODE_ENV`.

4. `apps/web/src/lib/auth/auth.ts:6`
- Fix: remove deep source import from `packages/db/src/schema/auth`.
- Why: boundary violation and fragile builds.

5. `apps/web/src/components/forms/login-form.tsx:67` (+ signup/logout analogs)
- Fix: replace `console.log(err)` with user-safe message + structured error logger.
- Why: avoids sensitive error dumping and noise.

6. `apps/web/src/app/(auth)/dashboard/page.tsx.bak`
- Fix: delete file from source control.
- Why: stale backup files pollute review surface and OSS quality.
