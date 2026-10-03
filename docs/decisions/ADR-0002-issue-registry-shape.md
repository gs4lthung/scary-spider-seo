# ADR-0002: Shape of the issue registry (T1.1)

## Context

T1.1 replaces the scattered issue definitions (`FilterKey` union, `filterPages` switch,
`ALL_PAGE_ISSUE_KEYS`, Overview's hand-written counters) with one registry, `ISSUE_DEFS` in
`src/lib/filters.ts`. The plan fixes most of its shape but leaves four points open or in
tension with "no visual or behavioral change":

1. The plan's `group` has six values (`response`, `content`, `links`, `indexing`, `technical`,
   `accessibility`), while Overview today shows ten accordion sections (Titles, Content,
   Canonical & Indexing, Performance, Meta & Social, Mobile Usability, Structured Data,
   Accessibility, Security, International). Grouping Overview by `group` would change the
   screen.
2. Several Overview tiles today have no tone (neutral colour), but the plan types `tone` as
   `"warn" | "bad"`.
3. `insecureLinks` is both a page signal (`insecureLinkCount > 0`, which filters the Pages
   table and is what Overview counts) and a resource signal (`isInsecure`, shown only in a
   resource's detail view). The plan gives each def one `scope` and one `test`.
4. Overview's duplicate title/meta/content tiles showed the number of distinct duplicated
   values (`Set.size`), while clicking them filtered to the pages carrying those values. The
   plan requires `countIssues` to equal `filterPages(...).length` for every key.

## Decision

1. Each `IssueDef` carries both the plan's `group` (semantic category, for exports and later
   tasks) and an optional `section` (the Overview accordion title). Overview builds its
   sections from `section`, in the order sections first appear in `ISSUE_DEFS`, so the screen
   keeps its current layout. A def without `section` (only `4xx5xx`) is not listed in an
   accordion; its count feeds the existing top-level "4xx/5xx/Error" tile.
2. `tone` is optional: `"warn" | "bad"` or absent for a neutral count, matching today's tiles.
3. `IssueDef` is a union of `PageIssueDef` and `ResourceIssueDef`. A page def may add an
   optional `resourceTest`, used only by `getResourceIssueKeys`; it never filters the
   Resources table. `insecureLinks` is a page def with `resourceTest`, `broken` is a resource
   def. `filterPages` leaves pages unfiltered for resource-scope keys and `filterResources`
   leaves resources unfiltered for page-scope keys, as before.
4. Overview counts come from `countIssues`, so the duplicate tiles now show the number of
   affected pages. This makes the tile agree with the number of rows its click shows, which
   is the invariant the plan's tests assert. The "4xx/5xx/Error" tile likewise uses the
   `4xx5xx` predicate (status null or >= 400) instead of its own bucket sum; the two differ
   only for a status of 0 or 1xx.
5. `ISSUE_DEFS` is in Overview visual order, so `getPageIssueKeys` (Issues column tooltip,
   detail modal, site tree) reports issues in that order instead of the old
   `ALL_PAGE_ISSUE_KEYS` order. The set of issues per page is unchanged.

## Consequences

- Adding an issue is one `ISSUE_DEFS` entry (with `group`, and `section` if it should appear in
  Overview) plus an `ISSUE_SOLUTIONS` entry; a missing solution fails `tsc`.
- Duplicate counts in Overview can be larger than before on the same crawl (pages, not
  distinct values). Filter results and per-page issue sets are unchanged.
