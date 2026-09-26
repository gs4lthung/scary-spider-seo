# Crawler fixtures

`site/` is a tiny static website with deliberate SEO defects, served by an
in-process HTTP server in `src/crawler/fixture_tests.rs`. The test crawls it
end to end (no network, no Tauri window) and asserts the raw signals each page
must produce.

| Path | Signal it exists to trigger |
| --- | --- |
| `/` | none: the clean baseline (title, meta, one h1, lang, viewport, OG, canonical, JSON-LD) |
| `/missing-title.html` | no title, no meta description, no h1, no lang |
| `/dup-a.html`, `/dup-b.html` | duplicate title, meta description and content hash; "Duplicate" appears 3 times in the HTML and twice in the visible text (custom search) |
| `/h1-and-images.html` | two h1s, one image without alt, one broken image (`/img/missing.png`), three images without `width`/`height`, one of them `/img/large.png` (150000 bytes, route in the test server) |
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
| `/anchors.html` | internal outlinks: collapsed text anchor, image-only anchor (alt `/img/logo.png`), empty anchor, "click here", `rel="nofollow ugc"`, a duplicate target |
| `/secure-headers.html` | served with `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` and `Referrer-Policy` (headers added by the test server); `/` sends none of them |
| `/en.html` | hreflang `en` (self), `fr` and `x-default` (`/`) |
| `/fr.html` | not linked; reached only through the hreflang annotation on `/en.html`. Annotates `fr` (self) and an invalid `fr-XX`, with no return link to `/en.html` |
| `/near-dup-a.html`, `/near-dup-b.html` | about 60 words of body text differing by one word: near duplicates (simhash within distance 3) with different content hashes |
| `/product.html` | custom extraction: a `.price` element with text `$19.99` (whitespace around it), `meta[property="og:image"]` content `{{ORIGIN}}/img/ok.png`, and Product JSON-LD |
| `/orphan.html` | not linked; only listed in `sitemap.xml` |
| `/noindex-in-sitemap.html` | not linked; listed in `sitemap.xml` and noindex (non-indexable URL in the sitemap) |
| `/gone-in-sitemap.html` | not linked; listed in `sitemap.xml`, file intentionally absent so it answers 404 |
| `/private/in-sitemap.html` | not linked; listed in `sitemap.xml` and disallowed by `robots.txt` (never fetched, so no file) |

`{{ORIGIN}}` in any served file is replaced with the server's `http://127.0.0.1:<port>`.

Adding a check: add a page here that triggers it, link it from `index.html`,
add a row above, and assert the new field in `fixture_tests.rs`.
