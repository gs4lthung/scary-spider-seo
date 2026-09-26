# ADR-0017: Custom search

Status: accepted (T3.3)

## Context

T3.3 adds Screaming Frog style Custom Search: up to 10 rules, each a text or a regex searched in
the raw HTML or the visible text. The plan fixes the shapes (`CustomSearchRule` in
`CrawlConfig.custom_searches`, `PageResult.custom_search_counts` keyed by rule id), literal rules
matching case-insensitively, "does not contain" being a frontend view of a zero count, dynamic
filter keys `custom:<id>:contains|missing`, and one CSV column per rule id. It leaves open:

- Case sensitivity of regex rules, and what a blank pattern means.
- Which pages get counts, and so which pages "does not contain" can match.
- Where rule names come from for a saved crawl, which stores pages but not the config.
- How ids are generated, and what the CSV column header says.
- Whether the counts are issues.

## Decision

**Matching.** Plain text rules are escaped and compiled case-insensitively. Regex rules compile as
written, so they are case-sensitive unless the pattern says `(?i)` (Screaming Frog's regex
behaviour). Both use the `regex` crate with the same 1 MiB `size_limit` as T3.1's URL patterns;
matching is linear time. The count is the number of non-overlapping matches, saturating at
`u32::MAX`. Rules with a blank pattern are skipped by Rust and dropped by the frontend before the
crawl starts. `start_crawl` compiles the rules (through `validate_config`, next to the T3.1
patterns and the T3.2 list cap) before touching any state; the error names the rule, or its
position when it has no name. More than 10 rules is an error.

**Which pages.** Only pages that reach `parse_page` (HTML responses, including 4xx/5xx HTML and
the final page of a redirect chain) get counts, and they get one for every rule, 0 included.
Robots-blocked, errored and non-HTML URLs have no entry, so they are in neither the "contains" nor
the "does not contain" filter. The text scope runs over the `body_text` that `parse_page` already
builds for the word count and hashes (scripts, styles, noscript and template stripped), exposed on
`ParsedPage`. The counts are a `BTreeMap` so the JSON and CSV order are deterministic. To keep
`fetch_and_parse` under clippy's argument limit, the mobile audit flag and the compiled rules
travel together in a per-crawl `PageAnalysis`.

**Saved crawls and resume.** The snapshot format is unchanged: rules are not saved. The frontend
remembers the rules a crawl started with (`shownSource.customSearches`) and labels rows from them;
for a loaded crawl, rule ids found on the pages are labelled from the options sheet when it has a
rule with that id, else "Custom search <id>". Older saved crawls load with empty counts
(`#[serde(default)]`). A resumed crawl counts its remaining pages with the rules it was resumed
with; pages from before keep their earlier counts.

**Ids and export.** The editor numbers ids `cs1`, `cs2`, ... one past the highest in use, so a
removed rule's id is not reused while its counts may still be on screen. The pages CSV gets a
`Custom Search: <id>` column per id seen in the crawl (the backend does not know the names),
blank for pages the rule never ran on.

**Not issues.** Custom search counts are informational: they get their own "Custom search" group in
the Overview with a "contains" and a "does not contain" tile per rule, a Pages column per rule and
a line in the page details, but they are not in `ISSUE_DEFS`, the issue total, the Issues column
or the issues export. Overview counts come from an incremental tracker in `App.tsx`, so a flush
costs O(new pages x rules), not a rescan.

## Consequences

- No new dependency; the `regex` crate from T3.1 is reused.
- Saved crawls stay readable in both directions; names of rules of a loaded crawl may fall back
  to ids.
- The CSV header shows ids rather than names; a later task could pass names to `export_csv`.
