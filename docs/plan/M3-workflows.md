# M3: Crawl workflows

Bigger features that change how a crawl is configured or compared, modeled on Screaming Frog's Include/Exclude, List mode, Custom Search, Custom Extraction, Compare mode and JavaScript rendering comparison. Each task touches `CrawlConfig` (Rust `types.rs` and `src/types.ts`), the options sheet `src/components/crawl-options-sheet.tsx`, or adds a view.

New `CrawlConfig` fields use `#[serde(default)]` so the frontend can omit them; the frontend `DEFAULT_CONFIG` in `src/App.tsx` gets the matching default.

**Milestone demo:** crawl a site with an exclude pattern, then crawl a pasted list of URLs, add a custom search and a CSS extraction and see their columns, save two crawls and open the Compare view to see what changed.

---

## T3.1: Include and exclude URL patterns

### Goal

Let the user restrict a crawl with regular expressions matched against the full URL: include (URL must match at least one, when any are given) and exclude (URL must match none). The start URL is always crawled.

### Depends on

None.

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/Cargo.toml` | Add `regex = "1"` (named dependency: needed to compile user patterns safely with linear-time matching) |
| `src-tauri/src/crawler/types.rs`, `src/types.ts` | `include_patterns: Vec<String>`, `exclude_patterns: Vec<String>` |
| `src-tauri/src/crawler/scope.rs` | `UrlScope::new(include, exclude) -> Result<UrlScope, String>`, `UrlScope::allows(&Url) -> bool`; registered in `crawler/mod.rs` |
| `src-tauri/src/crawler/crawl.rs` | Apply the scope before scheduling discovered internal links and sitemap URLs |
| `src-tauri/src/commands.rs` | `start_crawl` compiles the scope first and returns `Err("Invalid include pattern 2: ...")` on a bad regex, before touching state |
| `src/components/crawl-options-sheet.tsx` | Two textareas, one pattern per line, blank lines ignored |

### Steps

1. Compile with `RegexBuilder` and a size limit (`size_limit(1 << 20)`) so a hostile pattern cannot exhaust memory.
2. Excluded URLs are not recorded as pages at all (matching Screaming Frog), but still count toward `linked_urls` so orphan detection is unaffected.

### Tests

- `scope.rs`: `empty_scope_allows_everything`, `include_requires_a_match`, `exclude_wins_over_include`, `invalid_pattern_reports_its_index`.
- `fixture_tests.rs`: `exclude_pattern_skips_matching_pages` (`excludePatterns: ["/dup-"]`: neither duplicate page is crawled, everything else is) and `include_pattern_limits_the_crawl` (`includePatterns: ["noindex"]`: only `/` and `/noindex.html`).

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `node scripts/harness/gate.mjs` ends with `"ok":true`.

### Acceptance

- Named tests pass; the options sheet shows both fields and they reach `start_crawl` (checked in `crawl-options-sheet.tsx` and `DEFAULT_CONFIG`).

---

## T3.2: List mode: crawl a pasted list of URLs

### Goal

Screaming Frog's List mode: the user pastes URLs (one per line), the app crawls exactly those URLs without following links, while still checking their images and external links.

### Depends on

T3.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/types.rs`, `src/types.ts` | `list_urls: Vec<String>` (list mode when non-empty) |
| `src-tauri/src/crawler/crawl.rs` | In list mode: seed the frontier with every valid, deduplicated URL at depth 0; do not enqueue discovered links; fetch robots.txt per host and cache it in a `HashMap<String, RobotsRules>`; skip the sitemap |
| `src-tauri/src/commands.rs` | List mode never stores or consumes resume state |
| `src/components/url-combobox.tsx` or a new `src/components/list-mode-dialog.tsx` | Spider / List toggle and a textarea; shows the count of valid URLs and lists invalid lines |
| `src/lib/url.ts` | `parseUrlList(text): { valid: string[]; invalid: string[] }` |

### Steps

1. `start_url` is set to the first valid URL so events and saved crawls keep working.
2. Invalid lines never reach Rust; Rust still ignores unparsable entries defensively.
3. Cap list size at 50,000 URLs with a clear error.

### Tests

- `url.test.ts`: `parseUrlList trims, dedupes and rejects non-http lines`.
- `fixture_tests.rs`: `list_mode_crawls_only_the_listed_urls` (list `/noindex.html`, `/gone.html`, `/dup-a.html` gives exactly those 3 pages, even though they link to `/`), `list_mode_respects_robots_per_host` (listing `/private/secret.html` gives a robots-blocked result).

### Verify

- `npx vitest run src/lib/url.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` pass.

### Acceptance

- Named tests pass; gate `"ok":true`.

---

## T3.3: Custom search

### Goal

Screaming Frog Custom Search: up to 10 user rules, each "contains" or "does not contain" a text or regex, over the raw HTML or the visible text. Rust returns the match count per rule per page (a raw signal); the frontend exposes one filter per rule.

### Depends on

T1.1, T3.1 (uses the `regex` dependency it adds)

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/types.rs`, `src/types.ts` | `CustomSearchRule { id, name, pattern, is_regex, scope: "html" | "text" }` in `CrawlConfig.custom_searches`; `PageResult.custom_search_counts: HashMap<String, u32>` |
| `src-tauri/src/crawler/custom.rs` | Compile rules once per crawl (same size limit as T3.1), `count_matches(rules, html, text)` |
| `src-tauri/src/crawler/parse.rs` | Expose the visible body text it already builds so it is not recomputed |
| `src-tauri/src/crawler/crawl.rs` | Fill `custom_search_counts` for HTML pages |
| `src/lib/filters.ts` | Dynamic filter keys `custom:<id>:contains` and `custom:<id>:missing` handled in `filterPages` and Overview (a "Custom search" group listing each rule) |
| `src/components/crawl-options-sheet.tsx` | Rule editor (add, remove, name, pattern, regex toggle, scope) |
| `src-tauri/src/export.rs` | One column per rule id seen in the crawl |

### Steps

1. Plain text rules are matched case-insensitively as literals (escape then compile).
2. "Does not contain" is a frontend view of count == 0, not a separate Rust rule.

### Tests

- `custom.rs`: `counts_literal_matches_case_insensitively`, `regex_rules_match`, `text_scope_ignores_markup_and_scripts`.
- `fixture_tests.rs`: `custom_search_counts` (a rule for `"Duplicate"` finds 2 or more on `/dup-a.html` and 0 on `/noindex.html`).
- `filters.test.ts`: `custom contains and missing filters`.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- Named tests pass; gate `"ok":true`.

---

## T3.4: Custom extraction with CSS selectors

### Goal

Screaming Frog Custom Extraction: up to 10 rules, each a CSS selector plus what to extract (text, an attribute, or inner HTML). Values appear as extra columns in the Pages table and in the CSV export.

### Depends on

T3.3

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/types.rs`, `src/types.ts` | `ExtractionRule { id, name, selector, mode: "text" | "attr" | "inner_html", attr: Option<String> }` in `CrawlConfig.extractions`; `PageResult.extracted: HashMap<String, Vec<String>>` (max 10 values per rule, 500 chars each) |
| `src-tauri/src/crawler/custom.rs` | Parse selectors once per crawl; invalid selector returns an error from `start_crawl` naming the rule |
| `src-tauri/src/crawler/parse.rs` | Run extractions on the already-parsed document (no second parse) |
| `src/App.tsx` | One dynamic column per rule |
| `src/components/crawl-options-sheet.tsx` | Rule editor next to the custom search editor |
| `src-tauri/src/export.rs` | One column per rule id seen in the crawl, values joined with ` | ` |
| `src-tauri/tests/fixtures/site/product.html` | Fixture with `.price` text and `meta[property="og:image"]` content |

### Steps

1. Selectors run on the document before `parse_page` strips scripts and styles, so `script[type="application/ld+json"]` can be extracted.
2. Text mode collapses whitespace; values over 500 chars are truncated on a character boundary.
3. Add the fixture page, link it from `index.html`, update the fixture assertions.

### Tests

- `custom.rs`: `invalid_selector_is_rejected_with_rule_name`.
- `parse.rs`: `extracts_text_attr_and_inner_html`, `extraction_values_are_capped`.
- `fixture_tests.rs`: `extraction_fixture` asserts the extracted price and og:image values of `/product.html`.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` passes; gate `"ok":true`.

### Acceptance

- Named tests pass; dynamic columns appear for each configured rule (file inspection of the column builder).

---

## T3.5: Crawl comparison between two saved crawls

### Goal

Screaming Frog Compare mode: pick two saved crawl files and see added URLs, removed URLs, and changed URLs (status, indexability, title, meta description, H1, canonical, word count change over 20%), plus the change in every issue count. Optional host mapping to compare staging against production.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` | `read_crawl_snapshot(path)`: parses a saved crawl and returns it without touching `AppState` (unlike `load_crawl`) |
| `src/lib/compareCrawls.ts` | `compareCrawls(before, after, { mapHostFrom?, mapHostTo? })` returning `{ added, removed, changed: { url, fields: { name, before, after }[] }[], issueDeltas: { key, before, after }[] }` using `countIssues` from T1.1 |
| `src/lib/compareCrawls.test.ts` | Tests |
| `src/components/CompareView.tsx` | New "Compare" tab: two file pickers, host mapping inputs, summary counts, tables for added, removed, changed and issue deltas |
| `src/App.tsx` | Register the tab |

### Steps

1. URLs compare after normalization: trailing slash kept as is, fragment removed, host mapped when mapping is set.
2. The Compare tab works without a live crawl and never modifies the current crawl.

### Tests

- `compareCrawls.test.ts`: `detects added and removed urls`, `reports field changes`, `ignores word count changes under 20 percent`, `maps hosts before comparing`, `issue deltas match countIssues`.
- Rust: `read_crawl_snapshot_leaves_state_untouched` (a unit test in `commands.rs` calling the inner function on a temp file).

### Verify

- `npx vitest run src/lib/compareCrawls.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml` pass.

### Acceptance

- Named tests pass; the Compare tab exists; gate `"ok":true`.

---

## T3.6: Raw HTML vs rendered HTML comparison

### Goal

With JS rendering on, the crawler currently sends a HEAD request and then renders, so it never sees the raw HTML (`fetch_and_parse` in `crawl.rs` picks `Method::HEAD` when a browser exists). Screaming Frog shows what JavaScript changed. Add an opt-in "Compare raw and rendered HTML" option that also GETs and parses the raw HTML, and flag pages where JavaScript changes SEO critical elements.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/types.rs`, `src/types.ts` | `CrawlConfig.compare_raw_html: bool`; `PageResult.raw: Option<RawSignals { title, meta_description, h1, canonical, meta_robots, word_count, internal_link_count }>` |
| `src-tauri/src/crawler/parse.rs` | `RawSignals::from_parsed(&ParsedPage)` |
| `src-tauri/src/crawler/crawl.rs` | When rendering and `compare_raw_html`: GET instead of HEAD, parse that body into `raw`, then render as today |
| `src/lib/filters.ts` | Issues `jsChangesTitle`, `jsChangesCanonical`, `jsChangesRobots`, `jsAddsMostContent` (raw word count under 50% of rendered), `jsAddsLinks` (rendered internal links over raw plus 5) |
| `src/lib/issueSolutions.ts` | Solutions (source: Google "Understand the JavaScript SEO basics") |
| `src/components/crawl-options-sheet.tsx` | Checkbox, enabled only when JS rendering is on |

### Steps

1. The fixture tests run without Chrome, so the render path is covered by a test marked `#[ignore]` (run locally with `cargo test -- --ignored`); the pure parts are unit tested.
2. Add `src-tauri/tests/fixtures/site/js-title.html` whose inline script replaces the title and adds 10 links, for the ignored test.

### Tests

- `parse.rs`: `raw_signals_copy_parsed_fields`.
- `fixture_tests.rs`: `#[ignore] js_rendering_changes_are_captured` (requires Chrome).
- `filters.test.ts`: positive/negative per key; `raw signals absent means no js issues`.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- Five new issue keys with solutions; option in the sheet; named tests pass; gate `"ok":true`.
