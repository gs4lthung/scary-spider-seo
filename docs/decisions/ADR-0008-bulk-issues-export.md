# ADR-0008: Bulk issues export details (T1.7)

## Context

T1.7 adds "Export issues" and "Export issue summary" CSVs built in the frontend and written by
a new `save_text_file` command. The plan fixes the columns (URL, issue key, label, severity,
group; and issue, count), quoting and injection rules, but leaves open:

1. What "severity" is: `IssueDef` has an optional `tone` (`warn` / `bad` / absent), not a
   severity field.
2. Which resource issues appear: `getResourceIssueKeys` also lists page-scope issues that
   declare a `resourceTest` (`insecureLinks`), which `countIssues` does not count per resource.
3. Whether the summary lists issues with no affected URLs.
4. Where the two "menu items" live: the toolbar had plain buttons and no menu primitive.

## Decision

1. Severity is `tone`, with `info` for defs without a tone.
2. The issues CSV lists page-scope issues per page and resource-scope issues per resource,
   the same predicates `countIssues` uses, so the rows per key equal the Overview counts. The
   `resourceTest` detail-view signal is not exported as separate rows.
3. The summary lists every registry issue in registry order, including zero counts, so the
   file has a stable shape across crawls. Its columns are key, label, severity, group, count.
4. An "Export Issues" dropdown next to the existing export button, using the shadcn
   `dropdown-menu` primitive generated from the already installed `radix-ui` package (no new
   dependency). It is enabled when anything has been crawled.

## Consequences

- Issue CSVs agree with Overview counts, which the tests assert.
- `save_text_file` is a generic write-text command; it performs no path validation beyond
  what the OS enforces, like `save_crawl` and `export_csv`, since the path comes from the
  native save dialog.
