# Screaming Frog SEO Spider 24.3: black-box evidence

Reference for Screaming Frog parity work (`docs/plan/M5-sf-parity.md`). Gathered on 2026-10-22
by running the installed Screaming Frog SEO Spider 24.3 (free licence, default configuration)
against servers we control. Nothing was decompiled: its licence forbids reverse engineering, so
every fact here comes from its own `--help` output, its exports, or the HTTP requests it sent.

## Files

| File | What it is |
| --- | --- |
| `catalog-export-tabs.txt` | `ScreamingFrogSEOSpiderCli --help export-tabs`: every tab and filter (`Tab:Filter`), AI prompt and per-rule custom rows removed |
| `catalog-bulk-export.txt` | `--help bulk-export`: every bulk export |
| `catalog-save-report.txt` | `--help save-report`: every report |
| `fixture-issues-overview.csv` | Issues Overview report from crawling our fixture site (`src-tauri/tests/fixtures/site/`): issue name, type, priority, URL count |
| `fixture-request-log.txt` | Every request it sent while crawling the fixture site, in order, with timings |
| `user-guide-findings.md` | Findings from the official user guide, issues library and release notes, each with its source URL |

## How it crawls (observed)

From `fixture-request-log.txt`, default configuration:

- Fetches `/robots.txt` first, then the start URL, then breadth first.
- GET only, for pages and images alike (never HEAD). Images are fetched after every page.
- Headers: `User-Agent: Screaming Frog SEO Spider/24.3`,
  `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`,
  `Accept-Encoding: gzip`, `Cache-Control: no-cache`, `Pragma: no-cache`.
- Does not request `/sitemap.xml` by default, so sitemap-only (orphan) URLs are not found.
- Does not follow hreflang alternates (`/fr.html`) or robots-disallowed URLs (`/private/`).
- A redirect is recorded as its own 3xx URL without content, and its target is crawled as its
  own URL (`/old-page` and `/new-page.html`; both ends of the `/loop-a` / `/loop-b` loop).

## Every issue has a type and a priority

Type is Issue, Warning or Opportunity; priority is High, Medium or Low (`fixture-issues-overview.csv`).

## Thresholds and rules measured with probe pages

Probe sites with known counts and URL shapes, crawled with default settings:

| Check | Rule | Evidence |
| --- | --- | --- |
| Pages With High Internal Outlinks | more than 1,000 internal outlinks, repeats included | 1,001 and 1,002 flagged; 102 and 101 not |
| Pages With High External Outlinks | more than 10 external outlinks, repeats included | 11, 50, 51, 100, 101 and 101 identical links flagged; 10 not |
| Pages Without Internal Outlinks | an HTML page with 0 internal outlinks | page with no links flagged |
| URL: Contains Space | `%20` in the URL | `+` not flagged |
| URL: GA Tracking Parameters | `utm_*`, `_ga`, `_gl`, `gclid` | `fbclid` not flagged |
| URL: Internal Search | the URL has a query string and contains `search` | `/search?q=`, `?search=` flagged; `/search/shoes`, `?s=`, `?query=`, `?keyword=` not |
| URL: Repetitive Path | any path segment appears twice, not only adjacent ones | `/a/b/a/b/`, `/x/x/`, `/shop/shoes/shop/` flagged |
| Canonical Is Relative | canonical href without scheme and host | `href="rel-canonical.html"` and the fixture's `href="/"` flagged |
| Lorem Ipsum Placeholder | "lorem ipsum" in body text | flagged (Warning, High) |
| Soft 404 Pages | 200 page reading like an error page | "Page not found" title and "404 - Page Not Found" H1 flagged (Warning, High) |
| Unsafe Cross-Origin Links | external `target="_blank"` link without `noopener`/`noreferrer` | flagged (Warning, Low) |

## Reproducing

1. Serve a site and log its requests (any HTTP server that logs method, path and headers).
2. Run, for example:

   ```
   ScreamingFrogSEOSpiderCli.exe --crawl http://127.0.0.1:8765/ --headless --output-folder out --overwrite
     --export-format csv --export-tabs "Internal:All,Links:All" --save-report "Issues Overview"
   ```

3. Compare the exports with Scary Spider's results for the same site.
