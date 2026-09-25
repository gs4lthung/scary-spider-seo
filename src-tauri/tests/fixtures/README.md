# Crawler fixtures

`site/` is a tiny static website with deliberate SEO defects, served by an
in-process HTTP server in `src/crawler/fixture_tests.rs`. The test crawls it
end to end (no network, no Tauri window) and asserts the raw signals each page
must produce.

| Path | Signal it exists to trigger |
| --- | --- |
| `/` | none: the clean baseline (title, meta, one h1, lang, viewport, OG, canonical, JSON-LD) |
| `/missing-title.html` | no title, no meta description, no h1, no lang |
| `/dup-a.html`, `/dup-b.html` | duplicate title, meta description and content hash |
| `/h1-and-images.html` | two h1s, one image without alt, one broken image (`/img/missing.png`) |
| `/noindex.html` | meta robots noindex |
| `/canonicalised.html` | canonical pointing elsewhere |
| `/old-page` | 301 to `/new-page.html` (route in the test server) |
| `/redirect-to-gone` | 301 to `/gone.html`, so the redirect ends in a 404 (route in the test server) |
| `/loop-a` | redirect loop `/loop-a` <-> `/loop-b` (route in the test server) |
| `/private/secret.html` | disallowed by `robots.txt` |
| `/gone.html` | 404 (file intentionally absent) |
| `/bad-jsonld.html` | invalid JSON-LD |
| `/URL_Page.html?ref=nav` | URL with uppercase, an underscore and a query string (linked exactly like this) |
| `/a//b.html` | URL with repeated slashes in the path (serves `a/b.html`) |
| `/title-equals-h1.html` | title identical to the h1, meta description over 155 characters |
| `/nofollow.html` | meta robots nofollow |
| `/canonical-to-noindex.html` | canonical pointing at `/noindex.html` (a non-indexable page) |
| `/canonical-to-redirect.html` | canonical pointing at `/old-page` (a redirect) |
| `/headings.html` | an H1 then an H3 with no H2 (missing H2, non-sequential heading order) |
| `/multi-meta.html` | two `<title>` elements, two meta descriptions and a meta refresh |
| `/paged-1.html` | `rel="next"` to `/paged-2.html` (file intentionally absent, only reachable through the pagination link, so it answers 404) and `rel="prev"` to `/` |
| `/orphan.html` | not linked; only listed in `sitemap.xml` |
| `/noindex-in-sitemap.html` | not linked; listed in `sitemap.xml` and noindex (non-indexable URL in the sitemap) |
| `/gone-in-sitemap.html` | not linked; listed in `sitemap.xml`, file intentionally absent so it answers 404 |
| `/private/in-sitemap.html` | not linked; listed in `sitemap.xml` and disallowed by `robots.txt` (never fetched, so no file) |

`{{ORIGIN}}` in any served file is replaced with the server's `http://127.0.0.1:<port>`.

Adding a check: add a page here that triggers it, link it from `index.html`,
add a row above, and assert the new field in `fixture_tests.rs`.
