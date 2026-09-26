# ADR-0019: Crawl comparison

Status: accepted (T3.5)

## Context

T3.5 adds Screaming Frog style Compare mode: pick two saved crawl files and list added, removed
and changed URLs plus the change in every issue count, with optional host mapping. The plan fixes
`read_crawl_snapshot(path)` (parses without touching `AppState`), `compareCrawls(before, after,
{ mapHostFrom?, mapHostTo? })` in `src/lib/compareCrawls.ts` using `countIssues`, the compared
fields, the 20 percent word count threshold, and URL normalization (trailing slash kept, fragment
removed, host mapped). It leaves open:

- Where the comparison runs for large crawls, and how the command avoids blocking the UI.
- The filter context a saved crawl is classified with, since snapshots store neither the crawl
  mode nor the crawler's linked URL set.
- Which crawl the host mapping applies to, and how a typed host is read.
- The exact word count rule, how missing values compare, and the row shapes the view shows.

## Decision

**Command.** `read_crawl_snapshot` is an `async` Tauri command that parses on a blocking thread
(`tauri::async_runtime::spawn_blocking`), so a large file never runs on the main thread the way a
sync command would. It shares `parse_snapshot_file` with `load_crawl`; `load_crawl`'s state
replacement moved into `apply_snapshot`, which the unit test uses to prove the read leaves a
loaded crawl in place. Deserialization goes through `CrawlSnapshot`, so fields a crawl saved by an
older build lacks take their `#[serde(default)]` values.

**Where it runs.** `compareCrawls` is a pure function (tested in Vitest) and the Compare view runs
it in a module Web Worker (`src/lib/compareCrawls.worker.ts`, bundled by Vite with no new
dependency), falling back to the UI thread only when a worker cannot be created. Matching is two
`Map`s keyed by normalized URL, so it is linear in pages; issue counts are two `countIssues` passes.

**Filter context.** `buildCrawlFilterContext(pages)` builds the same context `App.tsx` builds
incrementally, from the existing one-shot helpers. A saved crawl classifies as a spider crawl
(`listMode: false`, as `handleOpenCrawl` already does), and a URL counts as linked when any crawled
page's `outlinks` points at it. Both crawls use the same builder, so their counts are comparable.
Crawls saved before a signal existed load
with its default (empty, 0 or false), which would inflate or hide counts: no `outlinks` makes
every sitemap page an orphan, no heading outline hides H2 issues. `SIGNAL_FAMILIES` in
`compareCrawls.ts` groups the M2 signals (heading outline, title/meta counts and pagination,
outlinks, security headers and mixed content, hreflang links, image dimensions and sizes, content
simhash) with a per-crawl "captured" test (some page shows the signal, or nothing in the crawl
could have produced it) and the issue keys that depend on each. When either crawl lacks a
family, its issue deltas carry `comparable: false`: the view shows the change as "n/a" and
leaves them out of "Issue counts changed". The heuristics are conservative: a current crawl that
genuinely has none of a signal where the site had the precondition may also read as n/a.

**Host mapping.** The mapping is applied to both crawls (and to canonical URLs) so it works
whichever crawl is staging. Inputs accept a bare host, a host with port, or a full URL; each is
reduced to the `URL.host` form, lowercase. An empty or identical pair means no mapping.

**Collisions.** When two pages of one crawl normalize to the same URL (fragment variants, or a
mapped host that the crawl also contains), the first is kept and the rest are counted in
`collisions`, which the view reports under the summary.

**Changes.** Text fields compare after treating empty and missing as the same, so an absent value
in an older crawl is not a change. Word count changes when `|after - before| > 0.2 * before`
(so any change from 0 counts). Added and removed rows carry URL, status, indexability and title;
changed URLs are shown one row per changed field. Issue deltas list every registry key in registry
order; the view shows only changed ones by default with a toggle for all.

**View.** The Compare tab is force-mounted so chosen files and results survive tab switches; it
keeps its own state and never calls `load_crawl` or touches `App.tsx` crawl state. It keeps only
each file's pages, resources, start URL and save time, and Clear drops both. Each result is tagged
with the ids of the two picks and the host mapping it was computed from and is shown only while
they match; picking, swapping or clearing also drops any comparison still running, and the
pickers are disabled while one runs. Tables reuse the
virtualized `DataTable`, and crawled values render as React text only.

## Consequences

- Comparing two large crawls costs one structured clone of both into the worker, but classification
  and clustering never freeze the window.
- Issues that rely on the crawler's linked URL set (redirected internal links, sitemap orphans)
  may count slightly differently in Compare than in a live crawl of the same site, because the set
  is rebuilt from capped `outlinks`; both sides of a comparison use the same rule.
