# ADR-0007: Content, depth, size and redirect target audit decisions (T1.6)

## Context

T1.6 adds `lowWordCount`, `deepPage`, `largeHtml`, `internalRedirect` and `redirectToError`,
derived from the existing `wordCount`, `depth`, `htmlSizeBytes`, `redirectChain`, `status`
fields and the `linkedUrls` context set. The plan fixes the keys and thresholds but leaves
guards, tones and Overview placement open.

## Decision

- **`lowWordCount`**: `2xx && htmlSizeBytes > 0 && wordCount < 200`. Non-HTML and error pages
  have no words to count, so they are excluded rather than reported as thin. Tone `warn`,
  section Content.
- **`deepPage`**: `htmlSizeBytes > 0 && depth > 3`. Limited to HTML so images, PDFs and blocked
  URLs found deep in the crawl are not reported. Sitemap-seeded URLs have depth 0 and are never
  deep (their true click depth is unknown). Tone `warn`, section Canonical & Indexing, next to
  orphan pages, since both describe internal linking.
- **`largeHtml`**: `htmlSizeBytes > 1_048_576`. `htmlSizeBytes` is only non-zero for HTML, so
  no extra guard. Tone `warn`, section Performance.
- **`internalRedirect`**: `redirectChain.length > 0 && linkedUrls.has(url)`. "Internal" means
  another crawled page links to the URL, the same set `orphanPage` uses. A redirecting start
  URL or sitemap-only URL is therefore not reported. `linkedUrls` arrives with
  `crawl://done` and is not stored in saved crawls, so, like `orphanPage`, this issue is
  silent during a live crawl and after loading a saved crawl. Persisting `linkedUrls` would
  change the saved-crawl format and is left to a later task. Tone `warn`.
- **`redirectToError`**: `redirectChain.length > 0 && status !== 200`, per plan step 1 (the
  crawler stores the final status on the requesting URL). A capped redirect loop keeps its
  last 3xx and is included, because it never reaches a 200 either; it also appears under
  `redirectChainTooLong` (overlap kept, as in ADR-0005). Tone `bad`.
- Both redirect issues sit in the Canonical & Indexing section next to `redirectChainTooLong`,
  reusing an existing `OverviewSection` so no Overview change is needed.

## Consequences

- Five registry entries plus solutions; Overview counts, filtering and the detail view pick
  them up from the registry with no UI change.
- The fixture site gains `/redirect-to-gone` (301 to `/gone.html`), so the home page now has
  18 internal links.
