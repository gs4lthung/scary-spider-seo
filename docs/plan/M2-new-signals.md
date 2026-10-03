# M2: New raw signals from the crawler

Every task here adds fields to `PageResult` (or `ResourceResult`) in Rust, then the filters that classify them in TypeScript. The pattern for each new page field is the same:

1. Extract it in `src-tauri/src/crawler/parse.rs` (`ParsedPage`) or from response headers in `fetch_and_parse` (`src-tauri/src/crawler/crawl.rs`).
2. Add it to `PageResult` in `src-tauri/src/crawler/types.rs` with `#[serde(default)]`, and copy it across in `fetch_and_parse` where `PageResult` is built.
3. Mirror it in `src/types.ts`, and in `makePage` in `src/lib/filters.test.ts`.
4. Add it to `export_pages_csv` in `src-tauri/src/export.rs` (header and row at the same index).
5. Add unit tests in `parse.rs` (a `#[cfg(test)] mod tests` block; create it in the first task that needs it) and fixture assertions in `fixture_tests.rs`.
6. Add the filters, solutions and filter tests (overview section 2).

Lists stored per page are capped (constants named in each task) so one pathological page cannot bloat the crawl, the `crawl://page` event, or the saved file.

**Milestone demo:** crawl a real multilingual site with JS off; the new heading, directive, security, hreflang, image and near-duplicate issues appear in Overview; the detail modal of a page shows its inlinks with anchor text.

---

## T2.1: Heading outline: H2s, H1 values and heading order

### Goal

Screaming Frog H1 and H2 tabs: duplicate H1 across pages, H1 over 70 chars (T1.3 covers the first H1 only; this covers all), missing H2, multiple H2, duplicate H2 across pages, H2 over 70 chars, and non-sequential heading order (for example H1 then H3).

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | Collect `h1_values`, `h2_values` (cap `MAX_HEADINGS = 20` each), `h2_count`, `heading_levels: Vec<u8>` in document order (cap 200) |
| `src-tauri/src/crawler/types.rs`, `crawl.rs`, `export.rs`, `src/types.ts` | New fields |
| `src/lib/filters.ts` | Issues `duplicateH1`, `missingH2`, `multipleH2`, `duplicateH2`, `h2TooLong`, `nonSequentialHeadings`; duplicate trackers for H1 and H2 in `FilterContext` |
| `src/lib/issueSolutions.ts` | Solutions (sources: MDN "The HTML Section Heading elements", W3C WAI "Headings") |
| `src-tauri/tests/fixtures/site/headings.html` | Fixture: H1, then H3, no H2 |

### Steps

1. `heading_levels` uses one selector `h1, h2, h3, h4, h5, h6` so order is preserved; empty headings still count for order.
2. `nonSequentialHeadings`: any step where the level increases by more than 1.
3. `duplicateH1` and `duplicateH2` reuse the `DuplicateTracker` pattern already in `filters.ts` (incremental, see its comment).

### Tests

- `parse.rs`: `collects_heading_levels_in_document_order`, `caps_heading_lists`.
- `fixture_tests.rs`: `headings_fixture` asserts `h2_count == 0` and `heading_levels == [1, 3]`.
- `filters.test.ts`: positive/negative per key.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `npx vitest run src/lib/filters.test.ts` passes.

### Acceptance

- Six new issue keys with solutions; a saved crawl from before this task (a JSON snapshot without the new fields, add one as `src-tauri/tests/fixtures/legacy-snapshot.json` and a Rust test `legacy_snapshot_still_deserializes`) loads.
- Gate `"ok":true`.

---

## T2.2: Multiple titles, multiple meta descriptions, meta refresh and pagination links

### Goal

Screaming Frog filters: multiple `<title>` elements, multiple meta descriptions, meta refresh redirects, and `rel="next"` / `rel="prev"` pagination targets that are non-200 or not crawled.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `title_count`, `meta_description_count`, `meta_refresh: Option<String>` (content attribute of `meta[http-equiv=refresh]`, case-insensitive), `pagination_next`, `pagination_prev` (resolved absolute URLs) |
| `src-tauri/src/crawler/crawl.rs` | Queue `pagination_next`/`prev` targets like internal links (same host only) |
| types, export, `src/types.ts` | New fields |
| `src/lib/filters.ts` | Issues `multipleTitles`, `multipleMetaDescriptions`, `metaRefresh`, `paginationTargetError` |
| `src/lib/issueSolutions.ts` | Solutions |
| `src-tauri/tests/fixtures/site/multi-meta.html` | Two titles, two meta descriptions, meta refresh |
| `src-tauri/tests/fixtures/site/paged-1.html` | `rel=next` to `/paged-2.html` (absent, so 404) |

### Steps

1. `title_count` counts `title` elements in the head and body.
2. Pagination links only come from `link[rel=next]` / `link[rel=prev]` in the head.

### Tests

- `parse.rs`: `counts_multiple_titles_and_descriptions`, `extracts_meta_refresh_case_insensitively`, `resolves_pagination_links`.
- `fixture_tests.rs`: `multi_meta_fixture`, `pagination_target_is_crawled` (asserts `/paged-2.html` has status 404).
- `filters.test.ts`: positive/negative per key.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- Four new issue keys with solutions; named tests pass; gate `"ok":true`.

---

## T2.3: Internal outlinks with anchor text and rel attributes

### Goal

The crawler currently keeps only the count of internal links per page, so the app cannot show inlinks, anchor text or link equity. Record each page's internal outlinks with their anchor text and rel flags. Classification is in T2.4.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `internal_outlinks: Vec<LinkRef>` built alongside `internal_links` |
| `src-tauri/src/crawler/types.rs` | `LinkRef { url: String, anchor: String, nofollow: bool, is_image_link: bool }` (camelCase serde), `PageResult.outlinks: Vec<LinkRef>` with `#[serde(default)]`; constant `MAX_OUTLINKS_PER_PAGE = 1000` |
| `src-tauri/src/crawler/crawl.rs` | Copy into `PageResult` |
| `src-tauri/src/export.rs` | `export_links_csv` (source, target, anchor, nofollow) and `"links"` case in `commands::export_csv` |
| `src/types.ts` | `LinkRef`, `outlinks` |
| `src/App.tsx` / export menu | "Export all internal links" item |
| `src-tauri/tests/fixtures/site/anchors.html` | Links with text anchor, image-only anchor (uses alt), empty anchor, "click here", `rel="nofollow ugc"` |

### Steps

1. Anchor: whitespace-collapsed text of the `a` element, truncated to 200 chars; if empty and the link wraps an `img`, use its alt and set `is_image_link`.
2. Deduplicate nothing: two links to the same target with different anchors are both kept (Screaming Frog counts both).
3. Keep `internal_link_count` as is for compatibility.

### Tests

- `parse.rs`: `outlink_anchor_is_collapsed_text`, `image_link_uses_alt_as_anchor`, `nofollow_detected_among_multiple_rel_values`, `outlinks_are_capped`.
- `fixture_tests.rs`: `anchors_fixture` asserts the exact `outlinks` of `/anchors.html`.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` passes.

### Acceptance

- `outlinks` present on crawled pages and in saved crawls; old saved crawls still load (`legacy_snapshot_still_deserializes` passes; create the legacy snapshot fixture and test as described in T2.1 if they do not exist yet).
- "Export all internal links" writes one row per link.
- Gate `"ok":true`.

---

## T2.4: Link analysis: inlinks, link score, anchor audits

### Goal

Using T2.3's outlinks, compute per page: inlinks, unique inlinks, a 0 to 100 internal link score (PageRank over the internal graph), and anchor audits: non-descriptive anchor text, empty anchors, pages with only one inlink, and links to non-200 internal pages. Show inlinks in the detail modal.

### Depends on

T2.3

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/linkGraph.ts` | `buildLinkGraph(pages)` returning inlink lists and counts; `linkScore(graph, iterations = 20, damping = 0.85)` scaled so the top page is 100 |
| `src/lib/linkGraph.test.ts` | Tests |
| `src/lib/filters.ts` | `FilterContext.linkGraph`; issues `nonDescriptiveAnchors`, `emptyAnchors`, `singleInlink`, `linksToErrorPages` |
| `src/lib/issueSolutions.ts` | Solutions (source: Google "Link best practices for Google") |
| `src/components/DetailModal.tsx` | Inlinks and outlinks lists with anchor text |
| `src/App.tsx` | Inlinks, Unique inlinks, Link score columns |

### Steps

1. Non-descriptive anchor list (lowercase exact match after trimming punctuation): click here, here, read more, more, learn more, this, link, this link, go, continue, details. Keep it as an exported constant.
2. The graph is built once per `pages` change inside the same memo that builds `FilterContext`; score only recomputes when the crawl is not running or every 2 seconds while running (to keep UI responsive).
3. `singleInlink` excludes the start page (depth 0).

### Tests

- `linkGraph.test.ts`: `counts inlinks and unique inlinks`, `link score ranks a hub above a leaf`, `link score is stable for a graph with no links`, `handles 20k pages under 500 ms` (synthetic graph, uses `performance.now()`).
- `filters.test.ts`: positive/negative per key.

### Verify

- `npx vitest run src/lib` passes.

### Acceptance

- Four new issue keys with solutions.
- The Pages table has Inlinks, Unique inlinks and Link score columns, and `DetailModal.tsx` renders inlinks and outlinks with anchor text (file inspection).
- Gate `"ok":true`.

---

## T2.5: Security headers and mixed content

### Goal

Screaming Frog Security tab: missing Content-Security-Policy, X-Frame-Options (or CSP `frame-ancestors`), X-Content-Type-Options `nosniff`, Referrer-Policy, and mixed content (HTTP subresources such as scripts, stylesheets, iframes and media on an HTTPS page). HSTS exists already.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/crawl.rs` | Read `content-security-policy`, `x-frame-options`, `x-content-type-options`, `referrer-policy` into `Option<String>` fields next to `hsts` (also on the `base` result for non-HTML) |
| `src-tauri/src/crawler/parse.rs` | `mixed_content_count`: on an https base, count `script[src]`, `link[rel=stylesheet][href]`, `iframe[src]`, `video[src]`, `audio[src]`, `source[src]` resolving to http |
| types, export, `src/types.ts` | New fields |
| `src/lib/filters.ts` | Issues `missingCsp`, `missingFrameOptions`, `missingContentTypeOptions`, `missingReferrerPolicy`, `mixedContent` (https pages only) |
| `src/lib/issueSolutions.ts` | Solutions (sources: MDN header references, web.dev "Fixing mixed content") |
| `src-tauri/src/crawler/fixture_tests.rs` | Route `/secure-headers.html` that returns all four headers; assert both it and `/` |

### Steps

1. `missingFrameOptions` is satisfied by either header.
2. The fixture server is plain HTTP, so mixed content is covered by a `parse.rs` unit test with an https base, not the fixture.

### Tests

- `parse.rs`: `counts_http_subresources_on_https_page`, `ignores_mixed_content_on_http_page`.
- `fixture_tests.rs`: `captures_security_headers`.
- `filters.test.ts`: positive/negative per key.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- Five new issue keys with solutions; named tests pass; gate `"ok":true`.

---

## T2.6: Hreflang pairs and return-link validation

### Goal

Today only the hreflang codes are kept (`hreflang_values`). Keep the language and target pairs, then audit like Screaming Frog: missing return links, missing self-reference, missing `x-default`, invalid language or region codes, and hreflang targets that are non-200 or not indexable.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `hreflang_links: Vec<HreflangLink { lang, href }>` with resolved absolute hrefs (cap 300) |
| `src-tauri/src/crawler/crawl.rs` | Queue same-host hreflang targets like internal links |
| types, export, `src/types.ts` | New field (keep `hreflang_values`) |
| `src/lib/hreflang.ts` | `isValidHreflang(code)` against ISO 639-1 languages and ISO 3166-1 alpha-2 regions (static lists in the file), plus `x-default` |
| `src/lib/hreflang.test.ts` | Tests |
| `src/lib/filters.ts` | Issues `hreflangMissingReturn`, `hreflangMissingSelf`, `hreflangMissingXDefault`, `hreflangInvalidCode`, `hreflangTargetError` |
| `src/lib/issueSolutions.ts` | Solutions (source: Google "Tell Google about localized versions of your page") |
| `src-tauri/tests/fixtures/site/en.html`, `fr.html` | `en` annotates `en`, `fr`, `x-default`; `fr` annotates only `fr` (no return link) and uses an invalid `fr-XX` extra |

### Steps

1. Codes compare case-insensitively; region codes are validated only when present.
2. Return-link check only runs when the target was crawled.

### Tests

- `parse.rs`: `collects_hreflang_pairs`.
- `hreflang.test.ts`: `accepts en and en-GB and x-default`, `rejects en-XX and english`.
- `fixture_tests.rs`: `hreflang_fixtures` asserts both pages' `hreflang_links`.
- `filters.test.ts`: positive/negative per key.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib` pass.

### Acceptance

- Five new issue keys with solutions; named tests pass; gate `"ok":true`.

---

## T2.7: Image size and missing dimensions

### Goal

Screaming Frog Images tab: images over 100 KB and images missing `width`/`height` attributes (a layout shift cause).

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/crawl.rs` | `check_resource` returns `content_length` from the `Content-Length` header (HEAD, or the GET fallback) |
| `src-tauri/src/crawler/types.rs` | `ResourceResult.content_length: Option<u64>` with `#[serde(default)]` |
| `src-tauri/src/crawler/parse.rs` | `images_missing_dimensions` count per page |
| `src-tauri/src/export.rs` | Resource CSV column "Size (bytes)"; page CSV column |
| `src/types.ts` | New fields |
| `src/lib/filters.ts` | Issues `largeImage` (resource scope, over 102400 bytes), `imageMissingDimensions` (page scope) |
| `src/lib/issueSolutions.ts` | Solutions (sources: web.dev "Optimize Cumulative Layout Shift", "Serve images in modern formats") |
| `src-tauri/src/crawler/fixture_tests.rs` | Route `/img/large.png` returning 150000 bytes; link it from `h1-and-images.html` with no dimensions |

### Steps

1. Missing dimensions means either attribute absent; CSS sizing is out of scope.
2. Update the `image_count` and `missing_alt_count` assertions affected by the new image.

### Tests

- `parse.rs`: `counts_images_missing_dimensions`.
- `fixture_tests.rs`: `records_image_content_length` (large is 150000, ok.png is 4).
- `filters.test.ts`: positive/negative per key.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- Two new issue keys with solutions; named tests pass; gate `"ok":true`.

---

## T2.8: Near-duplicate content via simhash

### Goal

The app detects only exact duplicates (`content_hash`). Add Screaming Frog style near-duplicates: pages whose visible text is at least about 90% similar.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `content_simhash`: 64-bit simhash over lowercase word 3-shingles of the body text, hashed with a stable hash (FNV-1a implemented inline; not `DefaultHasher`, whose output may change between Rust releases), serialized as a 16 char hex string (JSON numbers lose precision past 2^53); empty for pages under 20 words |
| types, export, `src/types.ts` | New field |
| `src/lib/nearDuplicates.ts` | `findNearDuplicates(pages, maxDistance = 3)`: split each hash into 4 bands of 16 bits, bucket by band, compare only candidates in shared buckets (pigeonhole: distance of 3 or less implies one identical band), return a map url to cluster id |
| `src/lib/nearDuplicates.test.ts` | Tests |
| `src/lib/filters.ts` | Issue `nearDuplicateContent` (excludes exact duplicates already flagged) |
| `src/lib/issueSolutions.ts` | Solution |
| `src-tauri/tests/fixtures/site/near-dup-a.html`, `near-dup-b.html` | About 60 words each, differing by one word |

### Steps

1. Implement simhash and FNV-1a in `parse.rs` with no new dependency; build it from the body text `parse_page` already extracts.
2. Build clusters in the same memo as the other cross-page trackers; show the cluster size in the detail modal.
3. Add the fixture pages, link them from `index.html`, update the fixture assertions.

### Tests

- `parse.rs`: `simhash_is_stable_across_runs` (hard-coded expected hex for a fixed text), `similar_texts_have_small_hamming_distance`, `short_pages_have_empty_simhash`.
- `nearDuplicates.test.ts`: `finds pairs within distance 3`, `ignores pairs at distance 10`, `handles 20k pages under 1 s`.
- `fixture_tests.rs`: `near_duplicate_fixtures` asserts Hamming distance of the two pages is 3 or less and their `content_hash` differs.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib` pass.

### Acceptance

- New issue key with solution; named tests pass; gate `"ok":true`.
