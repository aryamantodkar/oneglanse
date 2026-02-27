# OneGlanse — Coding Standards

Only standards with real violations in this codebase are listed. Each entry shows the actual offending code, the corrected version, and why it matters.

---

## 1. Never Use `any`

`any` disables TypeScript entirely for that value. Use the actual type, or `unknown` if genuinely uncertain, then narrow.

**Problem** (`apps/web/src/components/app-sidebar.tsx:198`):
```typescript
groupedWorkspaces.map((group: any, idx: number) => (
```

**Problem** (`apps/web/src/app/(auth)/dashboard/_hooks/use-dashboard-data.ts:12`):
```typescript
analysedPromptData: any,
```

**Fix:**
```typescript
// Derive the type from what groupedWorkspaces actually is:
groupedWorkspaces.map((group: WorkspaceGroup, idx: number) => (

// Use the real type or unknown + narrowing:
analysedPromptData: PromptAnalysis,
```

**Explanation:** Every `any` is a hole in the type system. If `group` is typed `any`, TypeScript won't catch `group.nmae` (a typo), `group.members.map(m => m.workspaceId)` (wrong field), or a refactor that changes the shape — all silently fail at runtime instead of compile time.

---