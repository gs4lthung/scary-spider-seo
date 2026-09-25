---
name: gseo-task
description: Workflow for implementing one planned task of the gseo desktop app (T<m>.<n> in docs/plan/). Use when starting, resuming or finishing a task, when asked "what's next", or when a task is blocked or the plan is ambiguous.
---

# gseo task workflow

A task is one `## T<m>.<n>: title` section in `docs/plan/M<m>-*.md`. Shared conventions and the dependency graph live in `docs/plan/00-overview.md`. Precedence: the task's plan, then `CLAUDE.md`, then the gseo skills, then generic skills.

## Steps

1. **Pick the task.** If none was named, `node scripts/harness/state.mjs first-open`, then `state.mjs next`. Done when you can name the task id and every dependency is `done`.
2. **Load context.** Read the task section, `docs/plan/00-overview.md`, and `CLAUDE.md`. Load the gseo skill for each area the task touches (table below). Done when you can list every file the task creates or changes.
3. **Branch.** `git switch -c task/<id>-<slug>` from an up-to-date `staging` (the harness base branch).
4. **Build in small commits.** Follow the plan's steps in order, one Conventional Commit per step (`feat:`, `fix:`, `test:`, `perf:`, `refactor:`, `docs:`, `chore:`), subject prefixed with the task id, e.g. `feat(T1.3): flag URLs over 115 characters`. Write the plan's named tests with the code, not after.
5. **Handle gaps.**
   - Plan silent → choose the simplest option consistent with the existing code, write `docs/decisions/ADR-NNNN-<slug>.md` (next free number; Context / Decision / Consequences), and continue.
   - Plan contradicts the code or `CLAUDE.md`, or a choice would change saved-crawl compatibility → stop that part, append the question to `docs/questions.md` with the task id, the options, and your pick.
6. **Prove it.** `node scripts/harness/gate.mjs --full` must print `"ok":true`. Then run every **Verify** command and check every **Acceptance** item. Done only when each item has evidence you observed (command output, test name).
7. **Report.** What changed, evidence per acceptance item, ADRs or questions added, and which task is now unblocked.

## Definition of done (every task)

- Gate `--full` passes: rustfmt, clippy `-D warnings`, `cargo test` (includes the fixture-site crawl tests), typecheck, ESLint, Vitest, `npm run build`.
- New behaviour has tests: Rust unit tests next to the code, fixture-site assertions for any crawl signal, `src/lib/filters.test.ts` for any classification.
- Old saved crawls still load: every new `PageResult`/`ResourceResult` field is `#[serde(default)]` and optional-safe in `src/types.ts`.
- No new dependency without an ADR saying why an existing one can't do it.
- No em dashes in user-visible copy (UI strings, `issueSolutions.ts`, README), per `CLAUDE.md`.
- Working tree clean on the task branch.

## Skills by area

| Area | gseo skill | Generic skills (if installed) |
| --- | --- | --- |
| Rust crawl loop, fetching, parsing, new raw signals, Tauri commands/events | `gseo-crawler` | none |
| A new or changed audit check (issue/filter) end to end | `gseo-audit-checks` | none |
| React views, tables, state in `App.tsx`, styling | `gseo-ui` | `vercel-react-best-practices`, `typescript-clean-code` |
| Visual design of any screen | `gseo-ui` (Design section) | `design-taste-frontend`, `minimalist-ui`, `redesign-existing-projects` |

The gseo skill wins where it disagrees with a generic one.
