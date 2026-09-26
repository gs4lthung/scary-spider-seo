# ADR-0020: Raw HTML vs rendered HTML comparison

## Context

T3.6 adds an opt-in `compareRawHtml` crawl option so pages rendered with headless Chrome also
get the signals of their raw HTML (`PageResult.raw`), and five issues flag what JavaScript
changed. The plan leaves open when `raw` is set, what happens when rendering fails, how the
comparison treats formatting differences, how saved crawls and crawl comparison behave, and how
the render path is tested when CI has no Chrome.

## Decision

- **Fetch.** With a browser and `compareRawHtml`, the page request is a GET instead of the HEAD
  used for plain rendering; the body is read before rendering. The raw body is parsed inside the
  existing `spawn_blocking` next to the rendered body, without custom extraction or custom search
  (those stay on the rendered page). The option is ignored without `renderJs`; the sheet disables
  it and turning rendering off clears it.
- **When `raw` is set.** Only when the page was actually rendered. If Chrome fails on a page, the
  already fetched raw body becomes the page itself (no second GET) and `raw` stays `None`, since
  comparing the raw HTML with itself means nothing.
- **Comparison rules** (frontend, `filters.ts`): titles and canonicals are compared
  whitespace-collapsed; meta robots as directive sets (case and order ignored, via
  `parseRobotsDirectives`); `jsAddsMostContent` needs a non-empty rendered page and raw words under
  `JS_RAW_WORD_RATIO` (0.5) of rendered; `jsAddsLinks` needs rendered internal links over raw plus
  `JS_ADDED_LINKS_THRESHOLD` (5). Every predicate requires `rendered && raw`, so crawls saved before
  T3.6 (no `raw`) and crawls without the option produce no JavaScript issues.
- **Crawl comparison.** A "raw vs rendered HTML" signal family in `SIGNAL_FAMILIES` is captured when
  some page has `raw` or no page was rendered, so comparing a crawl that rendered pages without the
  option (or predates it) marks the five deltas n/a instead of reporting them as fixed.
- **Tests.** The pure parts are unit tested without a browser: `RawSignals::from_parsed` /
  `parse_raw_signals` in `parse.rs`, the five predicates and their boundaries in
  `filters.test.ts`, the signal family in `compareCrawls.test.ts`, and a fixture crawl showing the
  option does nothing without rendering. The Chrome path is the `#[ignore]` fixture test
  `js_rendering_changes_are_captured` over `js-title.html`, run locally with
  `cargo test -- --ignored`; `js-title.html` is not linked from the fixture home so the default
  crawl's URL list is unchanged.
- **Out of scope.** No new table column or CSV column: the plan does not list them, and the issue
  filters already list the affected pages.

## Consequences

- Rendering with the comparison on costs one extra full GET per page (HEAD becomes GET) and one
  extra parse on the blocking pool; rendering without it is unchanged.
- Older saved crawls load unchanged (`raw` is `#[serde(default)]`, optional in `src/types.ts`).
- CI never exercises the Chrome path; a regression there shows only when the ignored test is run.
