# ADR-0006: Sitemap audit decisions (T1.5)

## Context

T1.5 adds `sitemapNonIndexable`, `sitemapNon200` and `notInSitemap`, derived from the
existing `discoveredViaSitemap`, `status`, `redirectUrl`, `indexability` and `depth` fields.
The plan names the keys and the `sitemapUsed` context flag but leaves the exact predicates,
tones and the source of "in the sitemap" open.

## Decision

- **"In the sitemap" means `discoveredViaSitemap`.** The crawler reads the sitemap before the
  crawl loop starts and seeds its URLs into the frontier right after the start URL, setting
  the flag only on URLs it had not already queued. On a fresh crawl that is every sitemap URL
  except the start URL, which is already in `visited`. No new raw field. The flag is set on
  fetched pages and, since the T1.5 review, on robots.txt-blocked pages too.
- **`sitemapNonIndexable`**: `discoveredViaSitemap && indexability !== "Indexable"`. This
  includes 4xx/5xx, redirected, noindex, canonicalised and robots-blocked URLs, as Screaming
  Frog's "Non-Indexable URLs in Sitemap" does. A 404 sitemap URL therefore also appears under
  `sitemapNon200` (overlap kept, as in ADR-0005).
- **`sitemapNon200`**: `discoveredViaSitemap && (status !== 200 || redirectUrl)`. A
  redirected URL is stored with its destination's final status, so a non-empty
  `redirectUrl` is what marks a 3xx sitemap entry. A null status (fetch error, robots
  block) counts as non-200.
- **`notInSitemap`**: `sitemapUsed && !discoveredViaSitemap && depth > 0 && htmlSizeBytes > 0
  && indexability === "Indexable"`. `depth > 0` excludes the start URL, which is queued before
  sitemap URLs are seeded and so never carries the flag; the solution text says so.
  Sitemap-seeded URLs also get depth 0, but they carry the flag and are excluded by
  `!discoveredViaSitemap` anyway, so `depth > 0` only ever removes the start URL.
- **`sitemapUsed`** is tracked incrementally in `App.tsx` (a ref set when an ingested page
  has `discoveredViaSitemap`, reset with the other derived trackers). `getSitemapUsed(pages)`
  is the equivalent helper for tests and one-off callers.
- **Tones and placement.** All three are `warn`, group `indexing`, in the "Canonical &
  Indexing" Overview section next to the orphan-page row.

## Consequences

- No saved-crawl format change. The only Rust change is copying the sitemap flag onto
  robots.txt-blocked results, so blocked sitemap URLs reach both sitemap filters.
- If a crawl uses a sitemap but the sitemap lists only URLs that were already queued (for
  example on a resumed crawl, where `visited` already holds them), `sitemapUsed` stays false
  and `notInSitemap` is silent rather than reporting every page. Conversely, a URL listed in
  the sitemap that was already queued before seeding would be reported by `notInSitemap`;
  with the current seeding order only the start URL can be in that state, and it is
  excluded. Storing an explicit "listed in sitemap" flag is left to a later task.
