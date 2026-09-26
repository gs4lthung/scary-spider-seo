# ADR-0023: Site info technologies come from the start page's crawl fetch

## Context

`run_crawl` used to GET the start URL once for technology detection (`techdetect`) and then
fetch it again as the first crawled page. T4.6 removes that probe and reads the technologies
from the crawl's own fetch. Plan step 2 says a resumed crawl should "emit site info without
technologies". The plan does not say how the technologies get from the fetch to site info,
when `crawl://site_info` is sent, or what happens when the start page is never fetched for
some other reason.

## Decision

- **Carried on the outcome, for one page only.** `fetch_and_parse` takes a `PageTarget`. Its
  `detect_site_tech` flag is set only for the start page, and only while site info has not
  been sent yet. That fetch:
  - runs `detect_from_headers` on the final response. The manual redirect walk ends on the same
    response the old auto-following probe saw, which `redirecting_start_page_reports_the_target_headers`
    checks.
  - runs `detect_from_html` on the raw HTML inside the existing `spawn_blocking` parse.
  - returns both as `PageFetchOutcome::site_tech`.

  Every early return after the response (non-HTML page, body read failure, parse failure) still
  carries the header half. No other page pays for detection.
- **Same inputs as the old probe when rendering.** With a browser, pages are normally fetched
  with HEAD and the body comes from Chrome. The start page is fetched with GET instead, which
  costs one request per crawl. That way the headers are GET headers, and `detect_from_html`
  runs on that GET's raw body rather than on the rendered DOM. Rendering can also navigate the
  tab to a different document, for example through a script redirect. That body is also the
  fallback when rendering fails, so no second GET is made then. It only feeds the raw vs
  rendered comparison when `compare_raw_html` is on.
- **Everything else is still gathered before the loop.** llms.txt, IP and hosting lookups run
  where they did and fill a pending `SiteInfo`. `emit_site_info` sends it at most once:
  - when the start page's outcome arrives, with its technologies;
  - before the loop, without technologies, in list mode when the start URL is not listed;
  - when robots.txt blocks the start page, without technologies, since nothing is fetched;
  - after the loop, without technologies, if the crawl stopped before any of the above.
- **A resumed crawl sends no site info.** This deviates from plan step 2. In practice, a
  resumed crawl is only possible in the same session with the same start URL: a different
  start URL or `load_crawl` discards resume state. The frontend already holds the first run's
  complete site info, and `setSiteInfo` would replace it with a copy missing the technologies.
  So when the resumed frontier does not contain the start URL, the llms.txt, IP and hosting
  lookups are skipped and nothing is emitted (`resumed_crawl_sends_no_site_info`). If the first
  run stopped before fetching the start page, the start URL is still queued. In that case site
  info is gathered and completed from that fetch as usual
  (`resumed_crawl_with_the_start_page_queued_reports_technologies`).

## Consequences

- The start URL is requested once per crawl (`start_url_is_fetched_once`). The large-site test
  also checks that `GET /gen/0` happens only once.
- `crawl://site_info` now arrives after the first page instead of before it. The frontend only
  stores the payload (`setSiteInfo`), so nothing depends on the order.
- A robots-blocked start page, a crawl stopped before its first page, or a list that does not
  include the start URL shows site info without server, CDN, CMS or technologies. Previously
  the probe filled these in even for a blocked start page, which meant fetching a URL
  robots.txt disallows.
- With JS rendering on, the start page costs one GET instead of one HEAD.
- The saved-crawl format does not change: the `SiteInfo` fields are the same.
