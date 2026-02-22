# package-utils Audit (`@onescope/utils`)

## 1. Structural Issues
- Package is over-broad and mixes unrelated domains:
  - UI helpers (`cn`, tailwind merge)
  - markdown formatting
  - URL extraction
  - agent provider constants/selectors
  - web model selectors
- Dead/placeholder module:
  - `packages/utils/src/metrics/index.ts` contains comments only.
- Move recommendation:
  - split into focused modules/packages:
    - `@onescope/utils-core` (generic helpers)
    - `@onescope/agent-config` (provider constants/selectors)
    - `@onescope/content-utils` (markdown/url/extract)
- Immediate move example:
  - `packages/utils/src/agent/*`
  - to `packages/agent-config/src/*`.

## 2. Architectural Problems
- This package violates cohesion heavily.
- Provider registry and browser selector policy are not generic utilities; they are agent-domain configuration.
- Dependency direction becomes blurry because web and agent both pull from one huge utility surface.

## 3. Code Quality Audit
- `packages/utils/src/format/formatMarkdown.ts`
  - Problem: raw markdown parsing output with no sanitization safeguards.
  - Exact change: either sanitize output here or rename function to make unsanitized behavior explicit and force sanitizer at call site.
  - Production impact: XSS injection path when rendered as HTML.
- `packages/utils/src/agent/index.ts`
  - Problem: minor lint/format issue (`export * from "./botDetection.js"` missing semicolon).
  - Exact change: enforce formatter/lint in CI so this class of drift never lands.
  - Production impact: low direct risk, high signal of missing code-quality gates.
- `packages/utils/src/metrics/index.ts`
  - Problem: dead placeholder module.
  - Exact change: delete file and remove export from `packages/utils/src/index.ts`.
  - Production impact: confusing API surface and false discoverability.
- `packages/utils/src/index.ts`
  - Problem: monolithic barrel exposing everything by default.
  - Exact change: break into subpath exports (`@onescope/utils/url`, `@onescope/utils/format`, etc.).
  - Production impact: accidental coupling and oversized import surface.

## 4. Testing Requirements
### Missing Unit Tests
- markdown formatting behavior for unsafe inputs.
- URL utilities (`getDomain`, `removeUrlParams`, `getUniqueLinks`).
- extraction stats helpers for edge cases.
- provider constants integrity and selector completeness.

### Missing Integration Tests
- consume utility contracts from web and agent to verify no breaking behavior after split.

### CI Enforcement
- add strict unit test requirement for changed utility modules.

## 5. Production Hardening
- Missing explicit security contract around markdown output safety.
- Missing runtime validation for provider configuration tables.
- Minimal fix:
  - add sanitizer boundary and typed config validation for provider maps.
- Long-term fix:
  - separate domain-specific config from generic utils to reduce blast radius.

## 6. Dependency Audit
- Current dependencies are relatively light and justified (`clsx`, `marked`, `tailwind-merge`).
- Risk is not dependency weight; risk is API sprawl and misuse due over-broad barrel exports.

## 7. OSS Readiness Audit
- Not OSS-friendly in current shape because utilities are mixed with domain-specific policy.
- Contributors cannot easily tell what is stable utility API versus agent runtime config.

## 🔥 Critical — Must Fix Before Open Source
- Resolve markdown sanitization boundary.
- Remove dead `metrics` placeholder module from exports.
- Reduce API sprawl via explicit subpath exports.

## ⚡ High Priority — Fix This Week
- Split agent-specific utilities from generic helpers.
- Add unit tests for markdown/url/extract modules.

## 🟡 Medium Priority — Improve Soon
- Add package README documenting stable utility contracts.
- Add validation for provider constants/selectors completeness.

## 💤 Later Improvements
- Publish module-level benchmarks for heavy extraction helpers.
