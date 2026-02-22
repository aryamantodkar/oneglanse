# package-types Audit (`@onescope/types`)

## 1. Structural Issues
- Package is flat and broad; all type domains are re-exported from one barrel.
- No separation between stable public contracts and internal/evolving shapes.
- Suggested structure move:
  - `packages/types/src/contracts/*` for stable cross-app APIs.
  - `packages/types/src/internal/*` for evolving internal shapes.
- Move example:
  - `packages/types/src/types/analysis.ts`
  - to `packages/types/src/contracts/analysis.ts` for API-facing contracts.

## 2. Architectural Problems
- Type package is central but not backed by runtime schema contracts.
- Strong typing at compile time is undermined by untyped parsing in consuming code.
- Missing contract governance:
  - no versioning policy for breaking type changes.
  - no contract tests proving web and agent compatibility.

## 3. Code Quality Audit
- `packages/types/src/types/analysis.ts`
  - Problem: very large nested interface with no runtime validator counterpart.
  - Exact change: pair critical contracts with zod schema packages in consuming layers.
  - Production impact: runtime payload drift despite compile-time confidence.
- `packages/types/src/types/agent.ts`
  - Problem: provider list is authoritative but mirrored in other packages by comments and constants.
  - Exact change: enforce single-source usage and remove duplicated provider constants from other packages.
  - Production impact: provider drift and inconsistent behavior.
- `packages/types/src/index.ts`
  - Problem: broad barrel export with no internal/public segregation.
  - Exact change: split public entrypoint and internal entrypoint.
  - Production impact: accidental coupling to unstable types.

## 4. Testing Requirements
### Missing Unit/Contract Tests
- ensure provider list parity assumptions in consumers.
- ensure critical response contracts serialize/deserialize safely.

### Missing Integration Tests
- cross-package contract tests:
  - web routers returning `AnalysisRecord` compatible with UI usage.
  - agent worker output compatible with service ingestion contracts.

### CI Enforcement
- add type contract tests to CI on every PR touching `packages/types`.

## 5. Production Hardening
- Compile-time types alone are not sufficient for external input boundaries.
- Minimal fix:
  - document runtime validation requirement per contract.
- Long-term fix:
  - publish schema + type bundles (zod + inferred types) for critical contracts.

## 6. Dependency Audit
- Dependency footprint is minimal and appropriate.
- Keep package intentionally lean; do not add runtime libraries unless paired with schema strategy.

## 7. OSS Readiness Audit
- Good baseline for shared contracts.
- Missing compatibility/change policy for contributors.
- Needs docs on which exported types are stable.

## 🔥 Critical — Must Fix Before Open Source
- Define stable contract subset vs internal types.
- Add contract tests for web-agent-service compatibility.

## ⚡ High Priority — Fix This Week
- Add runtime schema companions for high-risk contracts.
- Remove provider list duplication in other packages.

## 🟡 Medium Priority — Improve Soon
- Add type change review checklist and compatibility policy.
- Add package README documenting contract ownership.

## 💤 Later Improvements
- Add automated API contract diff reporting in CI.
