# ADR-0018: Custom extraction

Status: accepted (T3.4)

## Context

T3.4 adds Screaming Frog style Custom Extraction: up to 10 rules, each a CSS selector plus what
to take from the matched elements (text, one attribute, or inner HTML). The plan fixes the rule
shape (`ExtractionRule { id, name, selector, mode, attr }` in `CrawlConfig.extractions`), the page
field (`PageResult.extracted`, at most 10 values per rule and 500 characters per value), that
selectors are parsed once per crawl and rejected by `start_crawl` naming the rule, that
extraction runs on the already-parsed document before scripts and styles are stripped, and one
CSV column per rule id with values joined by ` | `. It leaves open:

- The map type, which pages get entries, and what counts as a value.
- Blank selectors and attribute rules without an attribute.
- Where rule names come from for a saved crawl, how ids are generated, and resume.
- Column headers, and whether extracted values are issues.

## Decision

**Shape.** `PageResult.extracted` is a `BTreeMap<String, Vec<String>>` rather than the plan's
`HashMap`, like T3.3's `custom_search_counts`, so the JSON and CSV order are deterministic. It is
`#[serde(default)]`, as are `CrawlConfig.extractions` and `CrawlSnapshot.extractions`, so older
saved crawls and configs load unchanged. `mode` serializes as `"text" | "attr" | "inner_html"`.

**Parsing and matching.** `custom::Extraction::new` parses every selector with `scraper`
(already a dependency) through `validate_config`, next to the T3.1 patterns, T3.3 searches and
the T3.2 list cap, before any state is touched. Errors name the rule, or its position when it has
no name. More than 10 rules, a blank id, or an attribute rule with a blank attribute is an error;
a blank selector is skipped (the frontend drops such rules before starting). `parse_page_with`
runs the rules on the `Html` that `parse_page` builds, first, before `<script>`, `<style>`,
`<noscript>` and `<template>` are detached, so `script[type="application/ld+json"]` works. It
runs inside the existing `spawn_blocking` call next to custom search; `parse_page` keeps its
signature for the many callers that have no rules.

**Values.** Text mode collapses whitespace and trims; attribute mode trims the value and skips
elements without the attribute; inner HTML mode trims. Empty values are skipped, then the first
10 values in document order are kept and each is cut to 500 characters on a character boundary.
Only pages that reach `parse_page` (HTML responses) get entries, one per rule, an empty list
included, so "nothing matched" differs from "not extracted" (robots-blocked, errored and non-HTML
URLs).

**Saved crawls, ids and resume.** Exactly as ADR-0017 for custom search: `save_crawl` stores the
rules of the results on screen, a loaded crawl labels its columns from them only, new rules get a
random id (`ex-` and 8 hex digits), and continuing a stopped crawl gives a rule whose selector,
mode or attribute changed a fresh id (written back to the sheet) and merges the earlier rules so
their columns keep their names. The id helpers are shared with custom search in
`src/lib/ruleIds.ts`.

**Columns.** The Pages table gets one column per rule of the crawl (even before a page has
values), then one per unknown id found on the pages, labelled by the rule's name, else its
selector, else "Extraction <id>". A label already used gets " (2)", " (3)"... appended. Cells show
the values joined with ` | `; a page the rule never ran on is blank. Seen ids are tracked
incrementally in `App.tsx` (O(new pages x rules) per flush), and the columns rebuild only when
ids or labels change. The CSV export mirrors this with `Extraction: <label>` headers after the
custom search columns, only for ids present on at least one page. The page details list each
value too.

**Not issues.** Extracted values are informational: no filter, no Overview tile, not in
`ISSUE_DEFS` or the issues export.

## Consequences

- No new dependency; `scraper` already parses every page.
- Selector matching cost is bounded by the document size per rule; 10 rules is at most 10 extra
  tree walks per page, on the blocking pool.
- `save_crawl` and `export_csv` take an optional `extractions` argument; omitting it saves no
  rules and heads columns with bare ids.
