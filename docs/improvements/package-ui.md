# package-ui Audit (`@onescope/ui`)

## 1. Structural Issues
- Critical self-import boundary violation:
  - `packages/ui/src/components/sidebar.tsx` imports from `@onescope/ui` (the same package).
- Exact fix:
  - Replace package self-import with local imports:
    - from `@onescope/ui`
    - to relative paths in `packages/ui/src/components/*` and `packages/ui/src/hooks/use-mobile.ts`.
- Barrel surface is broad and unmanaged in `packages/ui/src/index.ts`.
- Suggested split:
  - `packages/ui/src/index.ts` for stable exports only.
  - `packages/ui/src/internal.ts` for app-private components.

## 2. Architectural Problems
- Package should be presentational and dependency-light, but currently exposes too many internals by default.
- Self-import pattern can create circular dependency behavior during build/runtime and makes module resolution fragile.
- Missing clear API stability boundary for OSS contributors.

## 3. Code Quality Audit
- `packages/ui/src/components/sidebar.tsx`
  - Problem: self-package import anti-pattern.
  - Exact change: local direct imports only.
  - Production impact: circular import risk and unpredictable tree-shaking.
- `packages/ui/src/index.ts`
  - Problem: exports all components without stability markers.
  - Exact change: explicitly export stable components and keep experimental/internal components unexported.
  - Production impact: accidental public API expansion and breaking-change risk.
- No component-level tests for complex behavior (sidebar interactions, keyboard shortcuts, cookie state).

## 4. Testing Requirements
### Missing Unit Tests
- `packages/ui/src/components/sidebar.tsx`
  - keyboard shortcut behavior, mobile toggle state, cookie writes.
- form primitives (`form.tsx`, `select.tsx`, `dialog.tsx`) for controlled/uncontrolled behavior.

### Missing Integration Tests
- host-app integration for sidebar/layout composition in `apps/web`.

### Missing E2E Tests
- app-level tests validating sidebar behavior across desktop/mobile in `apps/web`.

### CI Enforcement
- run component tests on UI package changes.
- require typecheck + tests before merge.

## 5. Production Hardening
- No accessibility regression tests around shared interactive components.
- No visual regression baseline for shared design system components.
- Minimal fix:
  - add a11y tests and keyboard navigation tests for core primitives.
- Long-term fix:
  - add visual snapshot regression tests and semver policy for UI exports.

## 6. Dependency Audit
- Dependency set is mostly expected for Radix-based UI package.
- Ensure peer dependency alignment for `react` and `react-dom` remains consistent with consuming apps.
- Revisit whether `react-dom` needs to be in `devDependencies` if already declared as peer.

## 7. OSS Readiness Audit
- No package-level README documenting design system usage and stability guarantees.
- Public API currently implicit via `index.ts` barrel.
- External contributors need explicit contribution rules for adding/modifying components.

## 🔥 Critical — Must Fix Before Open Source
- Remove `@onescope/ui` self-import from `sidebar.tsx`.
- Define stable public export boundary in `index.ts`.

## ⚡ High Priority — Fix This Week
- Add unit tests for sidebar interactions and keyboard behavior.
- Add package README with API and usage guidelines.

## 🟡 Medium Priority — Improve Soon
- Add accessibility test suite for core primitives.
- Add visual regression checks for high-impact components.

## 💤 Later Improvements
- Introduce component maturity labels (stable/experimental/deprecated).
