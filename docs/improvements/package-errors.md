# package-errors Audit (`@onescope/errors`)

## 4. Testing Requirements
### Missing Unit Tests
- `packages/errors/src/errorHandling.ts` map cases for:
  - BaseError
  - external HTTP-like errors
  - native Error
  - unknown values
- `packages/errors/src/lib/classifyError.ts` regex classification matrix.

### Missing Integration Tests
- Adapter tests from web/agent layers to ensure errors map correctly to transport contracts.

### Missing E2E/Contract Tests
- tRPC contract tests to ensure errors are thrown where expected rather than hidden in payload wrappers.

### CI Enforcement
- require coverage on error mapping and classification modules.

## 5. Production Hardening
- Missing structured error event format.
- Missing redaction policy for `meta` fields before logging.
- Minimal fix:
  - enforce `{ code, message, status, contextId }` shape in logger output.
- Long-term fix:
  - integrate centralized error tracking sink and correlation IDs.

## 6. Dependency Audit
- Dependency footprint is small and mostly appropriate.
- Keep `@onescope/types` dependency only if `ApiResponse` coupling remains.
- If `ApiResponse` moves out, consider decoupling from `@onescope/types` to make package transport-agnostic.

## 7. OSS Readiness Audit
- Good start on domain error classes.
- Missing explicit docs for when to throw vs wrap vs map.
- Public API is broad via barrel export; document stable vs internal utilities.

## 🔥 Critical — Must Fix Before Open Source
- Stop using `safeHandler` as the default strategy inside tRPC routers.
- Add typed error guards to replace `any` in error mapping.

## ⚡ High Priority — Fix This Week
- Introduce structured logger output format.
- Add unit tests for classification and mapping.
- Document package usage contract.

## 🟡 Medium Priority — Improve Soon
- Add explicit transport adapter utilities per framework.
- Add metadata redaction rules.

## 💤 Later Improvements
- Add OpenTelemetry error event enrichment hooks.
