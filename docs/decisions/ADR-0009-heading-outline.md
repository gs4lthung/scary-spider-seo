# ADR-0009: Heading outline signals and issues (T2.1)

## Context

T2.1 adds `h1Values`, `h2Values`, `h2Count` and `headingLevels` to `PageResult` and six issues
(`duplicateH1`, `missingH2`, `multipleH2`, `duplicateH2`, `h2TooLong`,
`nonSequentialHeadings`). The plan fixes the fields, caps and issue keys, but leaves open:

1. Whether empty headings count in `h1Values`/`h2Values`/`h2Count`.
2. Which heading a page is compared on for duplicate H1/H2: the first, or any of them.
3. How `missingH2` treats non-HTML pages, error pages, and pages from a crawl saved before
   this task (whose `h2Count` deserializes to 0).
4. Whether a page that starts below H1 (first heading an H3) is non-sequential.
5. The H2 length threshold, and how `h1TooLong` uses the new values.

## Decision

1. Empty headings are skipped for values and counts, matching the existing `h1Count`
   (`h1_count_ignores_empty_headings`); they still count in `headingLevels`, as the plan says.
   `h1Count`/`h2Count` stay exact; only the stored lists are capped (`MAX_HEADINGS = 20`,
   `MAX_HEADING_LEVELS = 200` in `parse.rs`).
2. Duplicates compare the first H1 (`h1`) and the first H2 (`h2Values[0]`), exact text, like
   Screaming Frog and like the existing duplicate title check. Comparing every H2 would flag
   nearly every page on sites whose templates repeat H2s ("Related posts", "Newsletter").
   Both trackers reuse `DuplicateTracker` incrementally in `App.tsx`; `getDuplicateH1Set` and
   `getDuplicateH2Set` are the batch helpers for tests.
3. `missingH2` only applies to 2xx pages with HTML (`htmlSizeBytes > 0`). A page with an H1
   but no recorded heading levels can only come from a crawl saved before this task, so its
   H2 count is unknown and it is not flagged. A legacy page with no H1 is still flagged; that
   is indistinguishable from a real page with no headings.
4. Only steps between consecutive headings count, as the plan states ("any step where the
   level increases by more than 1"). A page whose first heading is an H3 is not flagged here;
   a missing H1 is already reported by `h1Issues`.
5. `H2_MAX_LENGTH = 70` (Screaming Frog's H2 "Over 70 Characters"), measured in code points
   after trimming, like H1. `h1TooLong` now checks `h1` and every entry of `h1Values`.
   `nonSequentialHeadings` is in the `accessibility` group; the rest are `content`. All six
   are listed in the Overview "Content" section next to the H1 issues, with no tone, like the
   existing H1 issues.

## Consequences

- Older saved crawls load unchanged (`legacy_snapshot_still_deserializes`) and do not light up
  `missingH2` on every page with an H1.
- No new table column or detail line was added for the new fields (the plan does not list
  `App.tsx` columns); they are in the CSV export and drive the Overview counts.
