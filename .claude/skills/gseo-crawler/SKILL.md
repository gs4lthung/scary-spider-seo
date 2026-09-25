---
name: gseo-crawler
description: Conventions for the gseo Rust backend (src-tauri/): the crawl loop, HTTP fetching, HTML parsing, robots/sitemap, rendering, Tauri commands and events, and the fixture-site crawl tests. Use when adding a raw signal to PageResult/ResourceResult, changing crawl behaviour, or touching commands.rs/state.rs.
---

# Rust crawler

## Rules

- **Rust collects, the frontend judges.** `src-tauri/src/crawler/` returns raw facts (counts, strings, flags, header values). Whether something is an *issue* is decided in `src/lib/filters.ts`. Never put thresholds like "title over 60 chars" in Rust.
- **Adding a raw field** touches, in order: `parse.rs` (`ParsedPage` + extraction), `types.rs` (`PageResult`, with `#[serde(default)]` so older saved crawls still load), `crawl.rs::fetch_and_parse` (copy it into the `PageResult`), `src/types.ts` (camelCase mirror), `export.rs` (CSV column) when it's useful in a spreadsheet. Response-header signals come from `fetch_and_parse`, not `parse.rs`.
- **Selectors are `LazyLock<Selector>` statics** at the top of `parse.rs`; don't parse selector strings per page.
- **Events, not return values.** Results reach the UI through `crawl://page`, `crawl://resource`, `crawl://site_info`, `crawl://progress`, `crawl://error`, `crawl://done`. A new event needs a listener in `src/App.tsx`.
- **`run_crawl` is generic over `tauri::Runtime`.** Keep it that way (and any new helper that takes `AppHandle`) so tests can use `tauri::test::mock_app()`.
- **Cancellation and pause** are atomics checked in the loop; any new await inside the loop must be raced against `wait_for_cancellation` like the existing ones.
- **Resume semantics** (`CrawlResumeState`) must survive your change: stopping with a non-empty frontier and restarting the same start URL continues.
- **Politeness:** respect `delay_ms`, robots `Crawl-delay`, and `concurrency`. No unbounded spawning; new per-URL work goes through a `Semaphore`.
- **No panics on network input.** Malformed HTML, headers, JSON-LD, or XML must produce a value or an error string, never `unwrap()` on untrusted data.

## Testing

- **Unit tests** live in a `#[cfg(test)] mod tests` at the bottom of the module (see `robots.rs`, `parse.rs`).
- **Fixture-site tests** (`src/crawler/fixture_tests.rs`) crawl `tests/fixtures/site/` over a local HTTP server, with no network and no window. For every new crawl signal: add a page (or route in `respond()`) that triggers it, link it from `index.html`, add a row to `tests/fixtures/README.md`, update the expected URL list in `crawls_every_linked_page_exactly_once`, and assert the field.
- Run: `cd src-tauri && cargo test`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check`.

## Gotchas

- `build.rs` embeds the Windows Common Controls manifest through linker args so test binaries start on Windows. Don't revert it to plain `tauri_build::build()`: `cargo test` would crash with `STATUS_ENTRYPOINT_NOT_FOUND`.
- `page_client` has redirects disabled so `fetch_following_redirects` can record the chain; auxiliary fetches use `client` (auto-follow). Use the right one.
- With `render_js` on, the first request is `HEAD` and the body comes from Chrome; header-derived fields must still be set on that path.
- Fixture tests bind `127.0.0.1:0`; everything the fixture links to must be local (`https://example.invalid/` is used for an external link that is never fetched because `checkExternalLinks` is off).
