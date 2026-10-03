# M4: Structure and performance for large crawls

Every task here targets a problem visible in the current code. None changes what the app reports; behavior must be identical before and after, which the existing fixture and filter tests enforce.

Measured claims need a measurement: tasks that promise a speedup add a test or script that measures it and state the before and after numbers in the task report.

**Milestone demo:** crawl a 5,000 page site (or the synthetic fixture from T4.5 via `cargo test --manifest-path src-tauri/Cargo.toml large_site -- --nocapture`); the UI stays responsive while the crawl runs, and saving and reopening the crawl is fast.

---

## T4.1: Split App.tsx into columns, event hook and session hook

### Goal

`src/App.tsx` is about 1,100 lines and mixes four jobs: the Pages column definitions (`buildPageColumns`, roughly lines 91 to 412), the resource columns (`resourceColumns`), the Tauri event wiring with its 150 ms batching (the first `useEffect` in `App`), and the crawl command handlers (start, stop, pause, resume, export, save, open). Split it without changing behavior, so later UI work touches small files. `App` stays the single owner of crawl state (CLAUDE.md), so this extracts hooks and modules, not a store.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/components/columns/pageColumns.tsx` | `buildPageColumns` and its cell helpers (`flagCell`, `boolCell`, `linkCell`) |
| `src/components/columns/resourceColumns.tsx` | `resourceColumns` |
| `src/lib/eventBatcher.ts` | `createEventBatcher<T>(flush: (items: T[]) => void, delayMs)` returning `{ push, cancel }`: the batching logic now inline in the effect |
| `src/lib/eventBatcher.test.ts` | Tests |
| `src/hooks/useCrawlEvents.ts` | Registers the six `crawl://*` listeners (keeps the StrictMode `active` guard and its comment), uses the batcher |
| `src/hooks/useCrawlSession.ts` | Command handlers and the resume and derived-tracker reset logic |
| `src/App.tsx` | Composes the above |

### Steps

1. Move code first with no edits (one commit), then introduce the batcher and hooks (separate commits), so the diff is reviewable.
2. Keep every comment that explains a non-obvious decision (StrictMode guard, incremental trackers, resume).

### Tests

- `eventBatcher.test.ts` (Vitest fake timers): `flushes once per delay window`, `preserves order across pushes`, `cancel drops pending items`.
- All existing tests pass unchanged.

### Verify

- `npx vitest run` passes.
- `node scripts/harness/gate.mjs --full` ends with `"ok":true`.

### Acceptance

- `src/App.tsx` is under 450 lines (`wc -l src/App.tsx`).
- No behavior change: the fixture crawl tests and all filter tests pass; the reviewer confirms moved code is unchanged apart from imports.

---

## T4.2: Incremental derived state and Overview counts

### Goal

Two costs grow with crawl size on every 150 ms flush while a crawl runs:

1. The derived-state `useMemo` in `App.tsx` ingests only new pages (good) but then copies every tracker: `new Set(titleTrackerRef.current.duplicates)`, the same for content and meta, and `new Map(canonicalStatusRef.current)`, all O(n) per flush.
2. Overview recounts every issue over all pages on every update (the `summary` memo, or `countIssues` after T1.1), O(n times issues) per flush.

Make both proportional to the new pages in the flush.

### Depends on

T4.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/issueCounter.ts` | `IssueCounter` that ingests pages once: page-local issues are counted incrementally; cross-page issues (duplicates, canonical target, orphan, link graph, near-duplicates) are recomputed at most once per second while crawling and once when the crawl finishes |
| `src/lib/issueCounter.test.ts` | Tests |
| `src/lib/filters.ts` | Registry entries gain `crossPage: boolean` |
| `src/hooks/useCrawlEvents.ts` / `src/App.tsx` | Pass trackers with a version number instead of copied Sets and Maps; consumers depend on the version |
| `src/components/Overview.tsx` | Reads counts from `IssueCounter` |

### Steps

1. Add a `crossPage` flag to every registry entry (true for anything reading `FilterContext`).
2. Replace copied collections with `{ version, trackers }`; memo dependencies use `version`.
3. Keep `countIssues` as the reference implementation for tests.

### Tests

- `issueCounter.test.ts`: `matches countIssues after incremental ingestion` (random 2,000 page set, ingested in batches of 37), `ingests each page once` (spy on the page-local predicates), `recomputes cross-page counts on finish`, `50k pages in 100 page batches stays under 2 s total`.

### Verify

- `npx vitest run src/lib/issueCounter.test.ts` passes.
- Gate `"ok":true`.

### Acceptance

- No `new Set(` or `new Map(` copies of tracker contents remain in the derived-state memo (`grep` in `src/App.tsx` and `src/hooks/`).
- Named tests pass; the task report states the time for the 50k test before (using `countIssues` per batch) and after.

---

## T4.3: Throttle crawl progress events

### Goal

`run_crawl` emits `crawl://progress` after every finished page and after every finished resource check, and the frontend calls `setProgress` and `setPaused` for each one outside the 150 ms batching, so a fast crawl with many images triggers thousands of React renders. Emit progress at most every 100 ms, plus once when the crawl pauses and once at the end, and batch it on the frontend too.

### Depends on

None.

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/crawl.rs` | `ProgressThrottle { last: Option<Instant>, interval }` with `should_emit(now, force)`; the three emit sites go through it; a forced final progress before returning |
| `src-tauri/src/crawler/fixture_tests.rs` | Event count test |
| `src/App.tsx` (or `src/hooks/useCrawlEvents.ts` after T4.1) | Progress stored in a ref and applied in the same flush as pages |

### Steps

1. Keep the paused-loop progress emit (it already sleeps 200 ms) but route it through the throttle with `force` when the paused state changes.
2. The frontend still shows the final counts because of the forced last emit.

### Tests

- `crawl.rs` unit: `progress_throttle_limits_rate`, `progress_throttle_forces_through`.
- `fixture_tests.rs`: `progress_events_are_throttled`: listen for `crawl://progress` on the mock app (`app.listen_any`), crawl the fixture site with `concurrency: 1` and a `delayMs` of 0, assert the count is at most `pages + 2` and the last event reports `crawled` equal to the page count.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` passes.

### Acceptance

- Named tests pass; gate `"ok":true`; the task report states the progress event count for the fixture crawl before and after.

---

## T4.4: Stream saved crawls instead of cloning and pretty-printing

### Goal

`save_crawl` in `commands.rs` clones every page and resource, then builds the whole file in memory with `serde_json::to_string_pretty` before writing. `load_crawl` reads the whole file into a String and clones `snapshot.pages` into state. For large crawls this doubles or triples peak memory and pretty-printing inflates the file. Serialize directly from the locked state into a buffered file, compact, and cut the extra copies on load.

### Depends on

None.

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/types.rs` | `CrawlSnapshotRef<'a> { start_url: &'a str, saved_at_unix_ms, pages: &'a [PageResult], resources: Vec<&'a ResourceResult> }` with the same serde field names as `CrawlSnapshot` |
| `src-tauri/src/commands.rs` | `save_crawl`: `serde_json::to_writer(BufWriter::new(File::create(path)?), &snapshot_ref)` while holding the pages lock; write to `path.tmp` then rename, so a failed save never truncates an existing file. `load_crawl`: `serde_json::from_slice(&std::fs::read(path)?)` |
| `src-tauri/src/export.rs` or a new `src-tauri/src/snapshot.rs` | The save and load functions as plain functions (testable without Tauri state) |

### Steps

1. Pretty and compact files both load (serde does not care), so old saves keep working.
2. Keep exactly one clone on load (state plus the returned snapshot), or return only `start_url` and counts and let the frontend call `get_pages` and `get_resources`; pick the smaller change and say which in the report.

### Tests

- `save_then_load_round_trips` (temp dir), `loads_a_pretty_printed_legacy_file` (uses the legacy snapshot fixture from T2.1 if present, else a pretty-printed file written in the test), `failed_save_keeps_the_previous_file` (target directory made read-only or path to a directory), `compact_output_is_smaller_than_pretty`.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml snapshot` passes.

### Acceptance

- `grep -n "to_string_pretty" src-tauri/src` finds nothing in the save path.
- Named tests pass; gate `"ok":true`.

---

## T4.5: Synthetic large-site fixture and crawl throughput budget

### Goal

Performance work needs a repeatable large crawl. Extend the fixture server with generated pages and add a throughput test that fails on large regressions.

### Depends on

None.

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/fixture_tests.rs` | Route `/gen/<n>`: an HTML page with a unique title and 10 links to `/gen/<(n * 7 + k) % N>` for k in 1..=10, plus 2 images; `N = 2000` |
| `src-tauri/src/crawler/fixture_tests.rs` | Test `large_site_crawl_completes_within_budget` |

### Steps

1. The test crawls from `/gen/0` with `maxPages: 2000`, `concurrency: 16`, `checkImages: true`, asserts exactly 2000 pages with status 200, and asserts wall time under 60 s (generous for debug builds on CI). Print pages per second with `eprintln!` so `--nocapture` shows it.
2. Make sure every `/gen/<n>` is reachable (the link pattern above reaches all of 0..2000 because 7 and 2000 are coprime; assert it in a tiny helper test).

### Tests

- `gen_links_reach_every_page`, `large_site_crawl_completes_within_budget`.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml large_site -- --nocapture` passes and prints a pages per second figure.

### Acceptance

- Named tests pass; the task report records the measured pages per second; gate `"ok":true`.

---

## T4.6: Reuse the start page response for site info

### Goal

Before crawling, `run_crawl` GETs the start URL once for technology detection (the site info block that calls `techdetect::detect_from_headers` and `detect_from_html`), and then the crawl loop fetches the same URL again as its first page. Detect technologies from the first page fetch instead, so the start URL is requested once.

### Depends on

T4.5

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/crawl.rs` | Move technology detection to when the depth 0 page outcome arrives (carry headers and body needed by `techdetect` on the outcome for that page only), then emit `crawl://site_info`; keep llms.txt, IP and hosting lookups before the loop, emitting site info once with everything |
| `src-tauri/src/crawler/fixture_tests.rs` | Request counting in the fixture server |

### Steps

1. Add a per-server `DashMap<String, usize>` of request counts (method plus path) exposed by `FixtureServer`.
2. When resuming a crawl, the start page is not refetched; emit site info without technologies in that case (document it in a comment).

### Tests

- `start_url_is_fetched_once`: after a fixture crawl, `GET /` count is 1.
- `site_info_still_reports_technologies`: listen for `crawl://site_info` on the mock app; serve a `Server: fixture-server` header on `/` and assert it is reported.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` passes.

### Acceptance

- Named tests pass; gate `"ok":true`.
