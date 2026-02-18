# Lessons Learned

Patterns and corrections to avoid repeating mistakes.

---

## Database / Schema

- **Always run migrations after schema changes.** Added a new column (`enabledProviders`) but forgot to generate or run the migration — app crashed silently because the DB column didn't exist.
- **Drizzle config must point to built files or use glob patterns.** `schema/index.ts` uses `.js` imports (ESM), which break when drizzle-kit loads TypeScript source directly. Use `./src/schema/*.ts` glob or point to `dist/`.
- **Modify the existing migration file, not create new ones.** When adding a column to an already-deployed migration, edit the original SQL file — don't create a new migration file unnecessarily.

## Docker / Infrastructure

- **Docker must be running before anything DB-related.** `DATABASE_URL` in `.env` points to `db:5432` (Docker hostname) — local dev won't work without Docker running.
- **`pnpm db:push` is the right dev tool.** For development, use `db:push` to sync schema without migration files. Reserve `db:migrate` for production.

## Timestamps

- **ClickHouse returns DateTime strings without timezone info.** `"YYYY-MM-DD HH:MM:SS"` is stored as UTC internally but JavaScript's `new Date()` interprets it as LOCAL timezone — off by timezone offset. Fix: append `'Z'` or use `toUnixTimestamp()` in the query.
- **Don't confuse `created_at` with `prompt_run_at`.** Responses were incorrectly showing when the user *created* the prompt, not when it was *executed*. Worker must generate `executionTime` fresh at job run time, not pass through the user prompt's `created_at`.

## Code Changes

- **Don't create new files unless necessary.** Prefer editing existing files. Creating new migration files, helper scripts, or wrapper files adds bloat.
- **Don't add logging the user didn't ask for.** User explicitly said no logging — focus on the root cause fix, not observability scaffolding.
- **Stash, don't delete.** When the user wants to revert changes for testing, use `git stash` so the work is recoverable.

## Planning

- **Ask about symptoms before assuming root cause.** "All timestamps are the same" means cron may have only run once — it's a symptom of the cron issue, not a separate date bug. Clarify before implementing.
- **Don't add logging/diagnostics unless explicitly requested.** User wants code fixes, not observability tools — stay focused on what was asked.
