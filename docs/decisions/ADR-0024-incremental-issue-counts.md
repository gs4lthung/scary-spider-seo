# ADR-0024: Incremental derived state and issue counts

## Context

T4.2 makes the per-flush cost of the derived-state memo and the Overview counts proportional
to the new pages. The plan names the pieces (`crossPage` registry flag, `{ version, trackers }`,
an `IssueCounter` that recounts cross-page issues at most once per second and on finish) but
leaves open: where the tracker ingestion lives, how a replaced `pages` array is detected, what
"while crawling" means for a paused crawl, how the O(pages) near-duplicate cluster snapshot is
avoided, and what clock the "50k pages in 100 page batches under 2 s" test runs against.

## Decision

- **Pure module for the trackers.** The ingestion loop moved from `useDerivedCrawlState` to
  `src/lib/derivedState.ts` (`syncDerivedCrawlState`, `buildFilterContext`) so tests can drive
  it without React. The hook keeps the state in a ref and returns `derived`, a new
  `{ version, trackers }` object per change; `filterContext` is rebuilt per version around the
  trackers' live Sets and Maps (no copies), so every memo keyed on it still recomputes.
- **Replacement detection by identity.** A `pages` (or `resources`) array counts as appended to
  when its element at the last ingested index is the last ingested object; otherwise the
  trackers and page-local counts start over. `resetDerivedTrackers` stays for the explicit
  resets in `useCrawlSession`.
- **Near-duplicate clusters are lazy.** `FilterContext.nearDuplicates` is a getter that builds
  the cluster snapshot on first read and caches it on that context, so a flush that nothing
  reads it in (the Overview between cross-page recounts) never pays for it.
- **Live means running and not paused.** `useIssueCounts` passes `running && !paused`; a paused,
  finished or loaded crawl always gets exact cross-page counts, equal to `countIssues`.
- **Trailing recount timer.** When a live update skipped the cross-page recount
  (`IssueCounter.hasPendingRecount()`), `useIssueCounts` sets one `setTimeout` of
  `CROSS_PAGE_RECOUNT_MS` that re-runs the update with the same inputs. Every newer flush
  clears it and sets its own, and unmounting clears it, so a stalled crawl still catches up
  about a second after its last flush.
- **Deterministic perf test clock.** `IssueCounter` takes an injectable `now`. The 50k test feeds
  batches back to back with a clock that advances as if the feed took exactly the 2 s budget,
  so the throttle allows a live recount at 0 ms and 1000 ms, then the final full recount. The
  budget is measured with `bestTimeMs` (CPU time) like the other performance tests.

## Consequences

- While a crawl runs, cross-page counts (duplicates, canonical targets, link graph, hreflang,
  near duplicates, sitemap, orphan) can lag the page-local counts by about a second at most,
  also when the crawl stalls right after a skipped recount (the trailing timer). They are
  exact once the crawl pauses or finishes.
- A cross-page recount is still O(pages x cross-page issues). At the real 150 ms flush rate and
  50k pages it costs well over 100 ms per second of crawling on a busy machine; making the
  duplicate and URL-set counts incremental would remove most of that if it becomes a problem.
- Consumers holding an old `FilterContext` see the live collections grow under it; they must
  key memos on the context (or `derived`), never on an inner Set or Map.
