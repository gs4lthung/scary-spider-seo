---
name: gseo-run
description: Run a gseo desktop-app milestone unattended: implement, verify, review and merge every task into local staging. Usage /gseo-run M1 (defaults to the first milestone with runnable tasks).
disable-model-invocation: true
---

# Unattended milestone run

You are the orchestrator. You never write product code yourself: you dispatch the `gseo-implementer`, `gseo-verifier` and `gseo-reviewer` subagents, move tasks through their states, merge, and report. The user is away: decide and continue without asking questions. Milestone argument: `$ARGUMENTS` (empty → `node scripts/harness/state.mjs first-open`; `none` → report that everything is finished and stop).

Policy set by the user: merge into local `staging` only, never push; a blocker is logged and skipped, and the run continues with tasks that do not depend on it.

## 1. Prepare

1. `node scripts/harness/preflight.mjs`. On exit 1, append each blocker to `docs/questions.md` under a `## Run <date> <M>` heading, commit it, report, and end the run.
2. `node scripts/harness/state.mjs init <M>` then `node scripts/harness/state.mjs run-start <M>`.
3. Git state: if the current branch is `task/<id>-*` with that task `in_progress`, resume it at step 2b. Otherwise `git switch staging`; if the tree is dirty, commit it as `chore(harness): checkpoint before <M> run`.

## 2. Task loop

Repeat until `node scripts/harness/state.mjs next` prints `none`:

a. **Start.** `state.mjs set <id> in_progress`. If the task's `attempts` now exceed 3, `state.mjs set <id> blocked "exceeded 3 attempts"` and continue the loop. Branch: `git switch -c task/<id>-<slug>` from `staging` (slug: 2 to 4 words from the title), or `git switch` to it if it exists.

b. **Implement.** Dispatch `gseo-implementer` with: task id, plan file, branch, and on later rounds the full findings text to fix. On `STATUS: BLOCKED`: `state.mjs set <id> blocked "<one-line reason>"`, `git switch staging`, continue the loop.

c. **Verify.** Dispatch `gseo-verifier` with the task id and plan file. On `VERDICT: FAIL`, send the FAILURES block back to step b as a fix round. After 3 failed verifications: `state.mjs set <id> blocked "verification failed: <first failure>"`, append the last FAILURES block to `docs/questions.md`, commit on the task branch, `git switch staging`, continue.

d. **Review.** Dispatch `gseo-reviewer` with the task id and plan file. On `CHANGES_REQUESTED`, send the blocker and major findings to step b, then re-run c and d. After 2 review rounds still requesting changes: merge anyway only if every remaining finding is `major` and none is `blocker`, and record them in the report; otherwise block the task as in c.

e. **Merge.** `git switch staging`, `git merge --no-ff task/<id>-<slug> -m "merge: <id> <title>"`. If the merge conflicts, `git merge --abort`, rebase the branch onto `staging`, re-run c, then merge. Then `state.mjs set <id> done "<merge commit sha>"`, and commit `docs/harness/` as `chore(harness): <id> done`.

Keep your own context lean: pass file paths and findings between agents, and keep only each agent's report block, not code.

## 3. Finish

1. `node scripts/harness/state.mjs run-stop` and `node scripts/harness/state.mjs summary <M>`.
2. Write `docs/harness/reports/<M>-<yyyy-mm-dd>.md`:
   - a table of every task: status, attempts, merge commit, gate result;
   - per merged task: the verifier's ACCEPTANCE lines (the evidence) and any recorded minor or unresolved major findings;
   - blocked and stuck tasks with their reasons and the `docs/questions.md` entries to answer;
   - a short manual check list for the user (`npm run tauri dev`, crawl a real site, what to look at for each merged task).
3. Commit the report and state as `docs(harness): <M> run report`.
4. Final message: one table of task statuses, the report path, and the questions that need an answer.

The run is complete when every task of the milestone is `done`, `blocked`, or stuck behind a blocked task, and the report is committed.
