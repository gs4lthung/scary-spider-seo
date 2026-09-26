# ADR-0024: Site info technologies come from the start page's crawl fetch

(Numbered 0024 because ADR-0022 is taken by T4.1 and 0023 was left free for T4.4, which ran
in parallel.)

## Context

`run_crawl` used to GET the start URL once for technology detection (`techdetect`) and then
fetch it again as the first crawled page. T4.6 removes the probe and reads the technologies
from the crawl's own fetch. The plan fixes the resume case (no technologies, since the start
page is not refetched) but not how the technologies travel, when `crawl://site_info` is sent,
or what happens when the start page is never fetched for another reason.

## Decision

- **Carried on the outcome, for one page only.** `fetch_and_parse` takes a `PageTarget` whose
  `detect_site_tech` flag is set only for the start page while site info is still pending. That
  fetch runs `detect_from_headers` on the final response (the manual redirect walk ends on the
  same response the old auto-following probe saw) and `detect_from_html` on the parsed body
  inside the existing `spawn_blocking` parse, and returns both as `PageFetchOutcome::site_tech`.
  Every early return after the response (non-HTML page, body read failure, parse failure) still
  carries the header half. No other page pays for detection.
- **Everything else is still gathered before the loop.** llms.txt, IP and hosting lookups run
  where they did, into a pending `SiteInfo`. It is emitted exactly once by `emit_site_info`:
  - when the start page's outcome arrives, with its technologies;
  - before the loop, without technologies, when the seeded frontier does not contain the start
    URL (a resumed crawl, which fetched it before stopping, or list mode where the start URL
    is not listed);
  - when robots.txt blocks the start page, without technologies (nothing is fetched);
  - after the loop, without technologies, if none of the above happened (stopped early).
- **With JS rendering on**, the page is fetched with HEAD and its body comes from Chrome, so
  headers come from the HEAD response and HTML markers from the rendered DOM. The markers
  `detect_from_html` looks for (script URLs, `wp-content`, framework attributes) survive
  rendering, so no extra GET is made for them.

## Consequences

- The start URL is requested once per crawl (`start_url_is_fetched_once`, and the large-site
  test checks `GET /gen/0` once).
- `crawl://site_info` now arrives after the first page instead of before it. The frontend only
  stores the payload (`setSiteInfo`), so nothing depends on the order.
- A resumed crawl, a robots-blocked start page or a crawl stopped before its first page shows
  site info without server, CDN, CMS or technologies. Previously the probe filled them in even
  for a blocked start page, which also meant fetching a URL robots.txt disallows.
- No saved-crawl format change: `SiteInfo` fields are unchanged.
