# M1: Issue registry and derived audits

Frontend-first milestone. T1.1 turns the scattered issue logic into one registry; every later task in the plan adds issues through it. The other tasks add Screaming Frog audits that need no new crawler data (the raw fields already exist on `PageResult`), so they are cheap and low risk.

**Milestone demo:** `npm run tauri dev`, crawl a real site, open Overview: every new issue row shows a count, clicking it filters the Pages table, the detail modal lists the issue with its solution, and "Export issues" writes a CSV.

---

## T1.1: Single issue registry for filters and Overview counts

### Goal

Today one issue is defined in four places that can drift: the `FilterKey` union and `filterPages` switch in `src/lib/filters.ts`, `ALL_PAGE_ISSUE_KEYS` in the same file, and a hand-written counter plus label list in `src/components/Overview.tsx` (`summary` useMemo around line 89, the `StatDef` arrays around line 196). `filterPages` also takes 7 positional arguments. Replace this with a single registry so adding an issue is one entry plus a solution.

### Depends on

None.

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/filters.ts` | `FilterContext` type, `ISSUE_DEFS` registry, `filterPages(pages, filter, ctx)`, `countIssues(pages, ctx)` |
| `src/lib/filters.test.ts` | Update call sites; registry completeness tests |
| `src/components/Overview.tsx` | Counts and labels come from the registry |
| `src/App.tsx` | Build one `FilterContext` with `useMemo`, pass it down |
| `src/lib/issueSolutions.ts` | Unchanged content; its type becomes `Record<IssueKey, IssueSolution>` so a missing solution is a type error |

### Steps

1. Define `FilterContext { duplicateTitles, duplicateContent, duplicateMeta, canonicalStatusMap, linkedUrls }` (all current optional positional args) and export an `emptyFilterContext()` helper.
2. Define `IssueDef { key, label, group: "response" | "content" | "links" | "indexing" | "technical" | "accessibility", tone: "warn" | "bad", scope: "page" | "resource", test: (item, ctx) => boolean }` and `ISSUE_DEFS: IssueDef[]` holding every existing issue with the exact predicate from the current switch, and the label and tone currently in `Overview.tsx`. Keep `h1Issues` as one issue (Overview's "missing H1 + multiple H1" sum equals `h1Count !== 1`).
3. Derive `IssueKey` from the registry, keep `FilterKey = "all" | "2xx" | "3xx" | IssueKey` so status buckets still work. `filterPages` and `filterResources` look up the def; `getPageIssueKeys` and `getResourceIssueKeys` iterate the registry.
4. Add `countIssues(pages, resources, ctx): Record<IssueKey, number>`; Overview renders its rows from `ISSUE_DEFS` grouped by `group`, in the current visual order.
5. Change `ISSUE_SOLUTIONS` to a full `Record<IssueKey, IssueSolution>`.
6. No visual or behavioral change. Filter counts must match before and after on the same crawl.

### Tests

- `filters.test.ts`: `every registry key has a solution`, `every registry key has a unique label`, `countIssues matches filterPages length for every key` (builds a mixed page set with `makePage` that triggers each existing issue at least once).
- All existing `filterPages` tests pass after mechanical call-site updates.

### Verify

- `npx vitest run src/lib/filters.test.ts` prints all tests passed.
- `npx tsc --noEmit` exits 0.
- `node scripts/harness/gate.mjs` ends with `"ok":true`.

### Acceptance

- `grep -n "let missingViewport" src/components/Overview.tsx` finds nothing (no hand-written counters remain).
- `filterPages` has exactly 3 parameters.
- Removing any entry from `ISSUE_SOLUTIONS` makes `npx tsc --noEmit` fail.
- The three new tests exist and pass.

---

## T1.2: URL structure audits

### Goal

Screaming Frog's URL tab: flag internal URLs with uppercase characters, underscores, query parameters, length over 115 characters, non-ASCII characters, repeated slashes in the path, and spaces or other characters that needed percent-encoding.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/filters.ts` | Issues `urlUppercase`, `urlUnderscores`, `urlParameters`, `urlOver115`, `urlNonAscii`, `urlMultipleSlashes`; constant `URL_MAX_LENGTH = 115` |
| `src/lib/issueSolutions.ts` | Solutions (source: Google Search Central "URL structure best practices") |
| `src/lib/filters.test.ts` | Tests |
| `src-tauri/tests/fixtures/site/URL_Page.html` | Fixture: uppercase and underscore |
| `src-tauri/tests/fixtures/site/index.html` | Links `/URL_Page.html?ref=nav` and `//double//slash.html` style path `/a//b.html` |
| `src-tauri/tests/fixtures/site/a/b.html` | Target of the double-slash link |
| `src-tauri/tests/fixtures/README.md` | New rows |
| `src-tauri/src/crawler/fixture_tests.rs` | Assert the URLs are crawled exactly as linked |

### Steps

1. Predicates run on the URL path plus query of `page.url` (not the host). Non-ASCII: the crawler stores URLs percent-encoded by the `url` crate, so detect `%` followed by a byte >= `%80` in the path, and decode for display.
2. Only pages with `status` 2xx or 3xx are flagged, so broken URLs are not double-counted.
3. Add the fixture pages and links, update the expected URL list and home `internal_link_count`.

### Tests

- `filters.test.ts`: one positive and one negative test per new key, plus `urlNonAscii detects percent-encoded UTF-8 path` and `urlParameters ignores a bare trailing question mark`.
- `fixture_tests.rs`: `url_audit_fixtures_are_crawled_verbatim` asserts `/URL_Page.html?ref=nav` and `/a//b.html` appear in the crawl with status 200.

### Verify

- `npx vitest run src/lib/filters.test.ts` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` passes.

### Acceptance

- Six new issue keys exist in the registry with solutions.
- All new unit tests and the fixture test pass.
- The gate prints `"ok":true`.

---

## T1.3: Title and meta description length, pixel width and duplication with H1

### Goal

Match Screaming Frog's Page Titles, Meta Description and H1 filters that can be computed from existing fields: title over 561 px or below 200 px, meta description over 155 or below 70 characters, over 985 px or below 400 px, title same as H1, H1 over 70 characters.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/pixelWidth.ts` | `estimatePixelWidth(text, fontPx)`: per-character width table for Arial (Google SERP font), 20px for titles and 14px for descriptions, unknown chars use the average width |
| `src/lib/pixelWidth.test.ts` | Tests |
| `src/lib/filters.ts` | Issues `titleOverPixels`, `titleUnderPixels`, `metaTooLong`, `metaTooShort`, `metaOverPixels`, `metaUnderPixels`, `titleSameAsH1`, `h1TooLong`; constants for every threshold |
| `src/lib/issueSolutions.ts` | Solutions |
| `src/App.tsx` | Add "Title px" and "Meta px" columns to the Pages table |
| `src-tauri/tests/fixtures/site/title-equals-h1.html` | Fixture: title identical to H1, long meta description |

### Steps

1. Build the width table from Arial advance widths at 1000 units per em for ASCII 32..126, scale by font size. Document the source in a comment.
2. Title comparisons are case-insensitive and whitespace-collapsed.
3. Add the fixture page, link it from `index.html`, update the fixture assertions.

### Tests

- `pixelWidth.test.ts`: `empty string is zero`, `wider glyphs measure wider than narrow ones` ("WWW" > "iii"), `a 60 character typical title lands between 450 and 600 px`.
- `filters.test.ts`: positive and negative per new key.
- `fixture_tests.rs`: `title_equals_h1_fixture` asserts `title` equals `h1` and `meta_description_length > 155`.

### Verify

- `npx vitest run src/lib` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` passes.

### Acceptance

- Eight new issue keys with solutions; Pages table shows the two pixel columns.
- All named tests pass; the gate prints `"ok":true`.

---

## T1.4: Directive and canonical audits

### Goal

Split directives the way Screaming Frog does and add the canonical checks it offers: pages with `noindex`, `nofollow`, `none`, directives only via `X-Robots-Tag`, missing canonical, canonical points to a non-indexable page, canonical points to a redirect, and canonicalised pages (exists as indexability, expose as an issue).

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/filters.ts` | `parseRobotsDirectives(metaRobots, xRobotsTag)` returning a set; issues `directiveNoindex`, `directiveNofollow`, `directiveNone`, `xRobotsTagPresent`, `missingCanonical`, `canonicalised`, `canonicalToNonIndexable`, `canonicalToRedirect`; `FilterContext` gains `pageByUrl: Map<string, PageResult>` |
| `src/lib/issueSolutions.ts` | Solutions (source: Google "Robots meta tag, data-nosnippet, and X-Robots-Tag specifications", "Consolidate duplicate URLs") |
| `src/lib/filters.test.ts` | Tests |
| `src-tauri/tests/fixtures/site/nofollow.html` | Fixture: `<meta name="robots" content="nofollow">` |
| `src-tauri/tests/fixtures/site/canonical-to-noindex.html` | Fixture: canonical pointing at `/noindex.html` |
| `src-tauri/tests/fixtures/site/canonical-to-redirect.html` | Fixture: canonical pointing at `/old-page` |

### Steps

1. `parseRobotsDirectives` lowercases, splits on commas, trims, and ignores a leading bot name prefix in `X-Robots-Tag` (`googlebot: noindex`).
2. `missingCanonical` applies to 2xx HTML pages only.
3. `canonicalToNonIndexable` uses `pageByUrl.get(canonical).indexability !== "Indexable"`; `canonicalToRedirect` uses the target's status 3xx or non-empty `redirectUrl`. Skip when the target was not crawled.
4. Add fixtures, link them, extend fixture assertions.

### Tests

- `filters.test.ts`: `parseRobotsDirectives handles bot prefixes and spacing`, and positive/negative per key.
- `fixture_tests.rs`: `directive_and_canonical_fixtures` asserts `meta_robots` of `/nofollow.html` and the resolved `canonical` of both canonical fixtures.

### Verify

- `npx vitest run src/lib/filters.test.ts` passes.
- `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` passes.

### Acceptance

- Eight new issue keys with solutions, all tests pass, gate `"ok":true`.
- `filters.test.ts` contains `canonicalToNonIndexable flags a page whose canonical target is noindex` built from pages shaped like the fixture (`/canonical-to-noindex.html` flagged, `/` not flagged), and it passes.

---

## T1.5: Sitemap audits

### Goal

Screaming Frog sitemap filters that the current data supports: non-indexable URLs in the sitemap, non-200 URLs in the sitemap, and indexable URLs not in the sitemap (only when the crawl used a sitemap). Orphan pages already exist.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/filters.ts` | Issues `sitemapNonIndexable`, `sitemapNon200`, `notInSitemap`; `FilterContext` gains `sitemapUsed: boolean` (true when any page has `discoveredViaSitemap`) |
| `src/lib/issueSolutions.ts` | Solutions (source: Google "Build and submit a sitemap") |
| `src/lib/filters.test.ts` | Tests |
| `src-tauri/tests/fixtures/site/sitemap.xml` | Add `/noindex-in-sitemap.html` and `/gone-in-sitemap.html` |
| `src-tauri/tests/fixtures/site/noindex-in-sitemap.html` | Fixture: unlinked, noindex |
| `src-tauri/src/crawler/fixture_tests.rs` | Extend `seeds_orphans_from_the_sitemap` |

### Steps

1. Known limit: the start URL is visited before the sitemap is read, so it never carries `discoveredViaSitemap`. Exclude the start URL (depth 0) from `notInSitemap` and note it in the solution text.
2. `/gone-in-sitemap.html` has no file, so the fixture server returns 404.

### Tests

- `filters.test.ts`: positive/negative per key, `notInSitemap is silent when no page came from a sitemap`.
- `fixture_tests.rs`: sitemap crawl asserts `/noindex-in-sitemap.html` has `discovered_via_sitemap` and indexability `Non-Indexable (noindex)`, and `/gone-in-sitemap.html` has status 404.

### Verify

- `npx vitest run src/lib/filters.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` pass.

### Acceptance

- Three new issue keys with solutions, tests pass, gate `"ok":true`.

---

## T1.6: Content, depth, size and redirect target audits

### Goal

Remaining Screaming Frog filters derivable today: low content (under 200 words on 2xx HTML), deep pages (crawl depth over 3), large HTML (over 1 MB), internal redirects (an internally linked URL whose `redirectChain` is non-empty; note the crawler stores the final status, so these pages usually show 200, not 3xx), and redirect chains ending in a non-200 page.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/filters.ts` | Issues `lowWordCount`, `deepPage`, `largeHtml`, `internalRedirect`, `redirectToError`; constants `LOW_WORD_COUNT = 200`, `DEEP_PAGE_DEPTH = 3`, `LARGE_HTML_BYTES = 1_048_576` |
| `src/lib/issueSolutions.ts` | Solutions |
| `src/lib/filters.test.ts` | Tests |
| `src-tauri/tests/fixtures/site/*` | Route `/redirect-to-gone` in `fixture_tests.rs` server (301 to `/gone.html`), linked from `index.html` |

### Steps

1. `redirectToError` uses the final status of a page with non-empty `redirectChain` (the crawler records the final response status on the requesting URL).
2. Add the `/redirect-to-gone` route to `respond()` in `fixture_tests.rs`, link it, update assertions.

### Tests

- `filters.test.ts`: positive/negative per key.
- `fixture_tests.rs`: `redirect_to_gone_reports_final_404` asserts status 404, non-empty `redirect_chain`, `redirect_url` ending in `/gone.html`.

### Verify

- `npx vitest run src/lib/filters.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml fixture_tests` pass.

### Acceptance

- Five new issue keys with solutions, tests pass, gate `"ok":true`.

---

## T1.7: Bulk issues export

### Goal

Screaming Frog's "Bulk Export > Issues": one CSV listing every URL with every issue it has (URL, issue key, issue label, severity, group), plus an issues summary CSV (issue, count). Classification stays in the frontend, so the frontend builds the CSV and Rust only writes the file.

### Depends on

T1.1

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/issueExport.ts` | `buildIssuesCsv(pages, resources, ctx)` and `buildIssueSummaryCsv(...)`, RFC 4180 quoting |
| `src/lib/issueExport.test.ts` | Tests |
| `src-tauri/src/commands.rs` | `save_text_file(path: String, contents: String)` command |
| `src-tauri/src/lib.rs` | Register the command |
| `src/App.tsx` (or `src/components/crawl-actions.tsx`) | "Export issues" and "Export issue summary" menu items using the dialog plugin `save()` |

### Steps

1. CSV quoting: wrap every field in quotes, double inner quotes, use `\r\n` line endings, prefix a UTF-8 BOM so Excel opens non-ASCII correctly.
2. Guard against CSV injection: prefix a single quote to fields starting with `=`, `+`, `-`, `@`.
3. `save_text_file` writes with `std::fs::write` and returns errors as strings.

### Tests

- `issueExport.test.ts`: `quotes commas quotes and newlines`, `neutralises formula injection`, `one row per page issue pair`, `summary counts match countIssues`.

### Verify

- `npx vitest run src/lib/issueExport.test.ts` passes.
- `node scripts/harness/gate.mjs` ends with `"ok":true`.

### Acceptance

- The two menu items exist and call `save_text_file`.
- All named tests pass.
