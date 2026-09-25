# ADR-0001: Agent harness for the desktop app

## Context

Feature work on the desktop app (Screaming Frog parity checks, optimization) is broken into
small planned tasks in `docs/plan/`. We want those tasks implemented by agents unattended, with
evidence that each one works, without giving the agents the ability to publish anything.

## Decision

- An orchestrator skill (`/gseo-run`) dispatches three subagents per task: implementer,
  verifier (read-only, re-runs everything), reviewer (read-only, ranked findings).
- One quality gate, `scripts/harness/gate.mjs`, mirrors CI: rustfmt, clippy `-D warnings`,
  `cargo test`, typecheck, ESLint, Vitest, and `npm run build` with `--full`.
- Crawl behaviour is tested end to end against a static fixture site served in-process
  (`src-tauri/tests/fixtures/site/`, `src/crawler/fixture_tests.rs`). To make that possible,
  `run_crawl` is generic over `tauri::Runtime` and tests use `tauri::test::mock_app()`.
  `build.rs` embeds the Windows Common Controls manifest via linker args so those test
  binaries start on Windows.
- Finished tasks merge into local `staging`. The agents can never push, release, or deploy
  (denied in `.claude/settings.json`).

## Consequences

- Every new crawl signal must come with a fixture page, which keeps the fixture site the
  living specification of what the crawler reports.
- Progress is committed in `docs/harness/state.json`, so a run can resume on another machine.
- A human still reviews `staging` and pushes.
