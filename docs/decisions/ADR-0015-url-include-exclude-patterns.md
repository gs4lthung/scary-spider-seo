# ADR-0015: Include and exclude URL patterns

Status: accepted (T3.1)

## Context

T3.1 lets the user restrict a crawl with regular expressions matched against the full URL. The
plan names the `regex` crate and the scope rules (include needs one match when any are given,
exclude needs none, the start URL is always crawled) but leaves open:

- Why a new dependency is acceptable.
- How patterns are matched (anchored or not), and how blank lines are treated.
- What happens to URLs already queued when a stopped crawl resumes with different patterns.
- The exact fixture pattern for `include_pattern_limits_the_crawl`.

## Decision

**Dependency.** `regex = "1"` is added. No existing dependency compiles user-supplied regular
expressions; `regex` guarantees linear-time matching (no catastrophic backtracking on hostile
patterns) and `RegexBuilder::size_limit(1 << 20)` caps the compiled size. It was already in
`Cargo.lock` as a transitive dependency, so the build does not grow.

**Matching.** Patterns are unanchored, like Screaming Frog, so `/blog/` matches anywhere in the
URL; users anchor with `^`/`$` themselves. The URL is matched without its fragment, which is the
same form the crawler dedups by and records pages under, so `$` anchors behave as the table
shows the URL. Each pattern is
trimmed and blank entries are skipped in both the frontend (`parsePatternLines`) and Rust, so the
index in `Invalid include pattern N: ...` is the 1-based position among the non-blank lines.

**Where it applies.** `run_crawl` checks the scope before scheduling a discovered internal link
or a sitemap URL. Out-of-scope URLs are never scheduled, so they never become pages, but they
are still inserted into `linked_urls`, so orphan detection is unchanged. They are not added to
`visited`, so each rediscovery re-checks the scope (a few regex matches, cheap).
`start_crawl` compiles the scope before taking the resume state or clearing results, so a bad
pattern leaves the backend untouched. `run_crawl` compiles it again (patterns are small) rather
than threading a compiled scope through `CrawlState`, which keeps the fixture helper unchanged.

**Resume.** The patterns may change between stopping a crawl and continuing it. A resumed
crawl re-filters its saved frontier with the new scope: queued URLs the scope excludes are
dropped (the start URL is always kept), removed from `visited`, and released from
`scheduled_count` so they don't use up `max_pages`. Covered by the fixture test
`resumed_crawl_drops_queued_urls_the_new_scope_excludes`.

**Fixture pattern.** The plan's `includePatterns: ["noindex"]` also matches
`/canonical-to-noindex.html`, which the fixture home page links to (added after the plan was
written). The test uses `/noindex\.html$` so the expected result is exactly `/` and
`/noindex.html`, as the plan intends.

## Consequences

- `CrawlConfig` gains `includePatterns` and `excludePatterns` (`#[serde(default)]`, empty in
  `DEFAULT_CONFIG`). `CrawlConfig` is not part of saved snapshots, so saved crawls are unaffected.
- The frontend clears its displayed results before `start_crawl` resolves (crawl events can
  arrive before it does). When the backend rejects the start, for example over an invalid
  pattern, `handleStart` restores the pages, resources, site info, linked URLs and progress it
  showed before and resets the derived trackers so they re-ingest them. The view then matches
  the backend again, including a later resumed start that only appends new pages. Patterns are
  not validated in the frontend because JavaScript regex syntax differs from Rust's.
