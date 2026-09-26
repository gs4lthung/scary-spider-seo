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
`ParsedPage`. `parse_page` and `count_matches` run together in one `spawn_blocking` call, since
both are CPU-bound and would otherwise stall the async workers driving other fetches. The counts
are a `BTreeMap` so the JSON and CSV order are deterministic. To keep `fetch_and_parse` under
clippy's argument limit, the mobile audit flag and the compiled rules travel together in a
per-crawl `PageAnalysis`.

**Saved crawls.** `CrawlSnapshot` gains `custom_searches` (`#[serde(default)]`): `save_crawl`
takes the rules of the results on screen from the frontend and stores them, and a loaded crawl
labels its rules from them. Snapshots saved before T3.3 still load, with no rules; rule ids found
on their pages (none, in practice) are labelled "Custom search <id>". Names are never borrowed
from the options sheet for a loaded crawl, because a rule there with the same id may count
something else.

**Ids and resume.** The editor gives each new rule a random id (`cs-` and 8 hex digits), never
derived from the rules in the sheet, so removing a rule and adding another cannot reuse an id
whose counts may still be on screen. Editing a rule keeps its id (so the editor row keeps focus),
which only matters when a stopped crawl is continued: then `reconcileCustomSearchIds` gives any
rule whose pattern, regex flag or scope differs from the earlier part of the crawl a fresh id and
writes it back to the sheet, so one id never stands for two searches across one crawl's pages.
The rules shown for a continued crawl are the earlier rules merged with the new ones, so earlier
columns keep their names, and pages crawled before the resume keep their earlier counts.

**Export.** `export_csv` takes the same rules. The pages CSV gets one `Custom Search: <label>`
column per rule id with a count on at least one page, where the label is the rule's name, else
its pattern, else (an id with no known rule) the bare id. The crawl's rules come first in rule
order, then any other id. Cells are blank for pages the rule never ran on.

**Not issues.** Custom search counts are informational: they get their own "Custom search" group in
the Overview with a "contains" and a "does not contain" tile per rule, a Pages column per rule and
a line in the page details, but they are not in `ISSUE_DEFS`, the issue total, the Issues column
or the issues export. Overview counts come from an incremental tracker in `App.tsx`, so a flush
costs O(new pages x rules), not a rescan.

## Consequences

- No new dependency; the `regex` crate from T3.1 is reused.
- Saved crawls stay readable in both directions: older snapshots load with no rules, and older
  builds ignore the extra `customSearches` field.
- `save_crawl` and `export_csv` take an optional `customSearches` argument; omitting it saves no
  rules and heads columns with bare ids.
