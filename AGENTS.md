# Engineering rules

OneGlanse is a self-hostable AI visibility tracker. Agent collects responses from real AI product UIs through browser automation. Model APIs are used for later analysis, not provider collection.

Code and tests define implemented behavior. [ARCHITECTURE.md](ARCHITECTURE.md) defines intended system boundaries. Use [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contribution steps.

## Navigate and change code

- Use CodeGraph for structure and call paths. Use `rg` for exact text and references. If `.codegraph/` is absent, run `pnpm codegraph:init` before structural exploration.
- For behavior changes, read the implementation, direct callers and consumers, and relevant tests before editing.
- Make the smallest coherent change. Preserve unrelated work and behavior.
- Keep one authoritative owner for each rule. Do not add an abstraction, option, or fallback for a hypothetical need.

## Protect the boundaries

- Keep reusable application behavior in `packages/services`. Web routes and components own the HTTP and UI boundary.
- Keep provider-specific browser behavior with its provider. Share it only when multiple current providers need the same behavior.
- PostgreSQL owns accounts, workspaces, and relational configuration. ClickHouse owns configured prompts, captured responses, and analysis data. Redis/BullMQ owns provider jobs and run coordination.
- Run provider browser automation in Agent, outside the Web request lifecycle.
- Preserve both `local` and `self-host` modes and their different auth, proxy, and scheduling behavior.
- Keep deterministic CI independent of live provider UIs, provider credentials, and paid model calls.

## Verify behavior

- Test behavior, not source-text edits. Add a regression test for a bug when practical.
- Test provider DOM and extraction changes with sanitized, deterministic fixtures. Use a live provider check only when the external UI boundary itself needs verification.
- Test Docker packaging through the built image and its runtime checks. Measure the affected path before and after a performance claim.
- Run the relevant focused checks while editing. Before completion, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm deadcode`, and `pnpm build`. GitHub's PR Gate is the merge check; the native image matrix runs in CI when relevant.
