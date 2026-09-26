# ADR-0011: Link analysis (inlinks, link score, anchor audits)

Status: accepted (T2.4)

## Context

T2.4 derives inlinks, unique inlinks, a 0 to 100 link score and four issues
(`nonDescriptiveAnchors`, `emptyAnchors`, `singleInlink`, `linksToErrorPages`) from T2.3's
`PageResult.outlinks`, entirely on the frontend. The plan leaves several details open:

- How link targets are matched to crawled pages, and whether a page's links to itself count.
- Whether `singleInlink` means one link or one linking page, and which pages it applies to.
- What "links to non-200 pages" means for targets the crawl never reached.
- The PageRank variant (duplicate edges, nofollow, dangling pages, scaling).
- How the graph stays cheap during a live crawl of tens of thousands of pages, where the rest
  of `FilterContext` is maintained incrementally.
- The Pages table already had a column headed "Inlinks" that actually showed
  `internalLinkCount` (links found *on* the page), and one headed "Outlinks" for external links.

## Decision

- **Matching.** A link targets a page when `LinkRef.url` equals `PageResult.url` exactly; the
  crawler records both the same way (absolute, fragment stripped). Self-links are dropped: a
  page linking to itself is not a vote from another page.
- **Counts.** Inlinks counts every link (a page linking twice counts twice, as Screaming Frog
  does). Unique inlinks counts distinct linking pages. Nofollow links are included in both.
- **`singleInlink`** fires when exactly one distinct page links to a 2xx HTML page at depth > 0
  (the start page and sitemap-seeded pages at depth 0 are excluded, per the plan). Using unique
  inlinks means two links from the same page still count as one route in.
- **`linksToErrorPages`** fires when any outlink points at a crawled page that did not answer a
  plain 200: 4xx/5xx, no response, or a redirect (a non-empty `redirectChain`, since the crawler
  stores the final status on a redirected URL). Targets the crawl never reached (depth or page
  limits) are unknown and not flagged, and neither are robots-blocked targets (no status, but
  never requested). The predicate reads `FilterContext.non200LinkSources`, a set of source URLs
  maintained incrementally as pages arrive (`ingestNon200LinkSources`): a new non-200 page
  marks the pages already linking to it through the graph, and a new page checks its own
  outlinks once. That keeps the Overview recount O(1) per page instead of a lookup per link.
- **Anchors.** `emptyAnchors` flags a link whose anchor is blank, which includes an image link
  whose image has no alt. `nonDescriptiveAnchors` compares the anchor lowercased, with leading
  and trailing punctuation, symbols and whitespace trimmed and inner whitespace collapsed,
  against the exported `NON_DESCRIPTIVE_ANCHORS`. Both results are cached per page object.
- **Link score.** Standard PageRank (damping 0.85, 20 iterations) over crawled pages, using only
  followed links, each (source, target) pair counted once. Pages with no followed outlinks
  spread their rank evenly over all pages. Scores are scaled linearly so the top page is 100 and
  rounded to one decimal; a graph with no links gives every page 100.
- **Live crawls.** `App.tsx` keeps the graph in a ref and ingests only newly arrived pages in the
  same memo that maintains the other trackers; the graph stores inlinks as parallel arrays per
  target (no object per link) and materialises `Inlink` objects only for the page open in the
  detail view, capped at `MAX_LINK_ROWS` (100) rows per list. Link scores are recomputed when
  the graph changes while no crawl runs, and every 2 seconds while one does
  (`useThrottledValue`, which restarts from the current graph when a crawl starts).
- **Columns.** The new "Inlinks", "Unique Inlinks" and "Link Score" columns take the Inlinks
  name; the existing columns are renamed "Internal Outlinks" and "External Outlinks" to say
  what they always showed. Column ids are unchanged, so saved column widths still apply.

## Consequences

- No Rust or saved-crawl change: everything is derived from `outlinks`, which older crawls load
  as an empty list (so they show zero inlinks and equal link scores).
- Because outlinks are capped at 1000 per page by the crawler, inlink counts on very link-heavy
  sites can undercount links that appear after the cap.
- The detail view lists at most 100 inlinks and 100 outlinks; "Export all internal links" is
  the full list.
