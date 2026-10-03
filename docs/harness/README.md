# gseo agent harness

Runs the desktop-app task plan unattended: for each task an **implementer** agent builds it, a
**verifier** agent independently re-checks every acceptance item, a **reviewer** agent checks it
against the plan and conventions, and the orchestrator merges it into local `staging`. Blockers
are logged to `docs/questions.md` and skipped; nothing is ever pushed. Background: ADR-0001.

## Pieces

| Piece | File | Role |
| --- | --- | --- |
| Plan | `docs/plan/00-overview.md`, `docs/plan/M<n>-*.md` | Tasks (`## T<m>.<n>: title`) with Files, Steps, Tests, Verify, Acceptance; dependency graph |
| Orchestrator | `.claude/skills/gseo-run/SKILL.md` (`/gseo-run M1`) | Task loop: implement, verify, review, merge; fix rounds; blockers; report |
| Implementer | `.claude/agents/gseo-implementer.md` | Builds one task on its branch, tests it, commits |
| Verifier | `.claude/agents/gseo-verifier.md` | Read-only; re-runs the gate, Verify commands and every acceptance item |
| Reviewer | `.claude/agents/gseo-reviewer.md` | Read-only; ranked findings against plan, CLAUDE.md, skills, security |
| Skills | `.claude/skills/gseo-{task,crawler,audit-checks,ui}/` | Workflow and this codebase's conventions |
| Gate | `scripts/harness/gate.mjs [--full]` | rustfmt, clippy, cargo test (incl. fixture crawl), typecheck, ESLint, Vitest, build |
| Fixture site | `src-tauri/tests/fixtures/site/` | Static site with known defects the crawl tests assert against |
| Preflight | `scripts/harness/preflight.mjs` | Tools present, clippy/rustfmt installed, npm deps installed |
| State | `scripts/harness/state.mjs` → `docs/harness/state.json` | Task status and dependencies (committed) |
| Runner | `scripts/harness/run.mjs` | Restarts headless sessions until a milestone is finished or a session makes no progress |
| Format hook | `scripts/harness/format-on-edit.mjs` | rustfmt / eslint --fix on every edited file |
| Reports | `docs/harness/reports/<M>-<date>.md` | Per-run results, evidence, blockers, manual checks |

## Running

Interactive (you can watch; it will not ask you anything):

```
/gseo-run M1
```

Fully unattended, surviving session limits (from a terminal in the repo root):

```bash
node scripts/harness/run.mjs M1     # one milestone
node scripts/harness/run.mjs all    # every milestone in order
```

Progress at any time:

```bash
node scripts/harness/state.mjs summary M1
```

## After a run

1. Read `docs/harness/reports/<M>-<date>.md`.
2. Answer new entries in `docs/questions.md`, then set those tasks back to pending.
3. Run the report's manual checks (`npm run tauri dev`, crawl a real site).
4. Push `staging` yourself when you are happy.

## Limits

- Each task gets at most 3 implement attempts, 3 verification rounds and 2 review rounds before it is marked blocked.
- The runner stops if a whole session changes nothing in `docs/harness/state.json`, so a stuck run never loops forever.
- Agents cannot push, release, or run wrangler (denied in `.claude/settings.json`).
