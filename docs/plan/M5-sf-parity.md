# M5: Screaming Frog parity, second pass

M1 to M4 closed most of the audit gap. A black-box comparison with Screaming Frog SEO Spider 24.3 (`docs/research/screaming-frog/README.md`) found what is still missing. Its tab catalog (`docs/research/screaming-frog/catalog-export-tabs.txt`) is the checklist. Match its definitions; where the research measured a rule, the task quotes it.

Already done on branch `fix/sf-parity-audit` (do not redo): content-page gating (`isContentPage`), `blockedByRobots`, redirects stored without content, RFC 9309 robots.txt, `Sitemap:` lines in robots.txt, `noInternalOutlinks`, `highInternalOutlinks`, `highExternalOutlinks`, `outlinksToLocalhost`, `soft404`, `httpUrl`, `loremIpsum`, `canonicalIsRelative`, `unsafeCrossOriginLinks`, and the URL checks for repetitive paths, spaces, GA parameters and internal search.

The rules in `00-overview.md` section 2 apply: Rust collects raw signals, `filters.ts` classifies, new fields are `#[serde(default)]`, every new signal gets a fixture page and assertion, and no user-visible string contains an em dash.

**Milestone demo:** crawl the fixture site with Scary Spider and with Screaming Frog (`docs/research/screaming-frog/README.md`, "Reproducing"); every issue in `fixture-issues-overview.csv` that does not need an external API has a matching Scary Spider issue with the same URL count, type and priority.

---

## T5.1: Issue type and priority

### Goal

Screaming Frog gives every issue a type (Issue, Warning, Opportunity) and a priority (High, Medium, Low), shown in its Issues tab and exports. Give every `ISSUE_DEFS` entry the same two fields, show them in Overview, and add them to the bulk issues export.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/filters.ts` | `type: "issue" \| "warning" \| "opportunity"` and `priority: "high" \| "medium" \| "low"` on `IssueDefBase`, set on every entry |
| `src/components/Overview.tsx` | Show type and priority per issue; sort each section by priority |
| `src/lib/issueExport.ts` | `Type` and `Priority` columns in the bulk issues export |
| `src/lib/filters.test.ts` | Registry test: every entry has both fields |

### Steps

1. Take each value from `docs/research/screaming-frog/fixture-issues-overview.csv` or the issues library section of `user-guide-findings.md` when Screaming Frog has the same issue. Otherwise pick by analogy and note it in a comment.
2. Keep `tone` as it is. Priority is a separate axis: tone colours the Overview tile, priority orders and labels it.

### Tests

- Registry test: every `ISSUE_DEFS` entry has a `type` and a `priority`.
- `issueExport.test.ts`: the export has both columns.

### Verify

- `npx vitest run src/lib/filters.test.ts src/lib/issueExport.test.ts` passes.

### Acceptance

- Every issue shows a type and a priority in Overview and in the bulk export.
- Gate `"ok":true`.

---

## T5.2: XML sitemap export

### Goal

Screaming Frog creates an XML sitemap from a finished crawl (`--create-sitemap`). Add Export > XML Sitemap: every indexable 200 HTML page (not redirected, not canonicalised, not noindex), split into files of 50,000 URLs with a sitemap index when there are more.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/export.rs` | `export_sitemap_xml(urls, path)`: writes the `urlset` (or index plus numbered files), XML-escaping `&`, `<`, `>`, `'` and `"` |
| `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` | `export_sitemap` command |
| `src/lib/sitemapExport.ts` | `sitemapUrls(pages)`: pages with `indexability === "Indexable"`, status 200, HTML, no redirect chain |
| `src/components/crawl-actions.tsx` | Menu entry with a save dialog, next to the CSV exports |

### Steps

1. `<lastmod>` is omitted: the crawl does not know when a page last changed, and Google ignores inaccurate values.
2. URLs are written as crawled (already normalized), in crawl order.

### Tests

- `export.rs`: escaping (`?a=1&b=2` becomes `&amp;`), the 50,000 split writes an index.
- `sitemapExport.test.ts`: noindex, canonicalised, redirected, non-HTML and 404 pages are excluded.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml export` and `npx vitest run src/lib/sitemapExport.test.ts` pass.

### Acceptance

- Exporting the fixture crawl writes a valid sitemap with only indexable pages.
- Gate `"ok":true`.

---

## T5.3: Character encoding from `<meta charset>`

### Goal

`resp.text()` honours only the `Content-Type` header's charset and otherwise decodes UTF-8 lossily, so a Latin-1 page that declares `<meta charset="iso-8859-1">` gets U+FFFD in its title, text and hashes. Decode like a browser: the header charset, else a `<meta charset>` or `<meta http-equiv="Content-Type">` in the first 1024 bytes, else UTF-8.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/Cargo.toml` | `encoding_rs` as a direct dependency. It is already in the tree through reqwest, so the build gains no new crate; this task names it as plan rule 6 requires |
| `src-tauri/src/crawler/crawl.rs` | Read the body as bytes and decode with `decode_body(bytes, content_type)` |
| `src-tauri/src/crawler/parse.rs` (or a new `encoding.rs`) | `sniff_meta_charset(&[u8]) -> Option<&'static Encoding>` |
| `src-tauri/tests/fixtures/site/latin1.html` plus a server route | A page served as bytes in ISO-8859-1 with only a meta charset |

### Tests

- Unit: `sniff_meta_charset` for both meta forms, quoted and unquoted, and a declaration after 1024 bytes being ignored.
- Fixture: the Latin-1 page's title contains `é` and no U+FFFD.

### Verify

- `cargo test --manifest-path src-tauri/Cargo.toml` passes.

### Acceptance

- The Latin-1 fixture title is decoded correctly; UTF-8 pages are unchanged.
- Gate `"ok":true`.

---

## T5.4: SEO elements outside `<head>`

### Goal

Screaming Frog's "Outside `<head>`" filters for page titles, meta descriptions, canonicals, directives and hreflang. Google ignores these elements in the body. They usually end up there when an element that is invalid in the head (an `<img>`, `<iframe>` or text) closes the head early.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `elements_outside_head: Vec<String>`, the kinds (`title`, `meta description`, `canonical`, `robots`, `hreflang`) found under `<body>` in the parsed tree |
| types, export, `src/types.ts` | New field |
| `src/lib/filters.ts` | Issue `elementsOutsideHead` |
| Fixture `outside-head.html` | An `<img>` in the head, followed by a canonical and a meta robots tag |

### Tests

- `parse.rs`: a canonical after an `<img>` in the head is reported; a normal head is not.
- Fixture assertion and filter tests.

### Verify

- `cargo test` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- The fixture page reports `canonical` and `robots` outside the head.
- Gate `"ok":true`.

---

## T5.5: HTML validation of the document structure

### Goal

Screaming Frog's Validation tab: invalid HTML elements in `<head>`, `<head>` not first in `<html>`, missing or multiple `<head>` or `<body>`, `<body>` before `<html>`, and documents over 15 MB. The html5ever tree builder repairs these, so they must be detected on the raw token stream, not on the parsed tree.

### Depends on

T5.4

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `html_validation: Vec<String>` from a single pass over start tags (html5ever's tokenizer, which scraper already depends on, or a small tag scanner that skips comments, scripts and styles) |
| types, export, `src/types.ts` | New field |
| `src/lib/filters.ts` | Issue `invalidHtmlStructure`, listing the problems in the page detail |
| Fixture `invalid-structure.html` | Two `<body>` tags and a `<div>` in the head |

### Tests

- One unit test per problem, plus one for a valid document reporting nothing.

### Verify

- `cargo test` passes.

### Acceptance

- Each Screaming Frog validation filter except "High Carbon Rating" has a matching problem string.
- Gate `"ok":true`.

---

## T5.6: Image alt text audits

### Goal

Screaming Frog separates "Missing Alt Attribute" (no `alt`, Issue) from "Missing Alt Text" (`alt=""`), and flags "Alt Text Over 100 Characters". Scary Spider counts only the missing attribute (`missingAltCount`). Add the other two.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `empty_alt_count`, `long_alt_count` (alt over `MAX_ALT_CHARS = 100`) |
| types, export, `src/types.ts` | New fields |
| `src/lib/filters.ts` | Issues `emptyAltText` (a warning only: an empty alt is correct for decorative images, and the solution must say so) and `altTextTooLong` |
| Fixture | Extend `h1-and-images.html` with a long alt |

### Tests

- Parser and filter tests, including a decorative `alt=""` image.

### Verify

- `cargo test` and `npx vitest run src/lib/filters.test.ts` pass.

### Acceptance

- Gate `"ok":true`.

---

## T5.7: Pagination audits

### Goal

Screaming Frog's pagination filters beyond what T2.2 covers: Sequence Error, Pagination Loop, Pagination URL Not in Anchor Tag (it flagged our `paged-1.html`), Multiple Pagination URLs and Unlinked Pagination URLs.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `pagination_next_count`, `pagination_prev_count` (multiple tags) |
| `src/lib/filters.ts` | Cross-page checks over `paginationNext`/`paginationPrev` and the link graph: `paginationSequenceError` (A's next is B but B's prev is not A), `paginationLoop` (following next returns to a visited page), `paginationNotInAnchor` (target not among the page's outlinks), `multiplePaginationUrls` |
| Fixtures | Pages `paged-1`/`paged-2` extended with a broken sequence and a loop |

### Tests

- Filter tests per key; the incremental path in `derivedState.ts` must match a full recompute (the existing "stays in sync" tests show the pattern).

### Verify

- `npx vitest run` passes.

### Acceptance

- Gate `"ok":true`.

---

## T5.8: Inlink audits

### Goal

Screaming Frog's link filters that depend on how a page is linked to: "Follow & Nofollow Internal Inlinks To Page", "Internal Nofollow Inlinks Only", "Non-Indexable Page Inlinks Only", and "Unlinked" canonicals and hreflang (the target is referenced by an annotation but no `<a>` links to it).

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/linkGraph.ts` | Per target: follow and nofollow inlink counts, and whether any source is indexable |
| `src/lib/filters.ts` | Issues `mixedFollowInlinks`, `nofollowInlinksOnly`, `nonIndexableInlinksOnly`, `unlinkedCanonical`, `unlinkedHreflang` |

### Tests

- Filter tests per key on small link graphs; incremental versus full recompute.

### Verify

- `npx vitest run` passes.

### Acceptance

- Gate `"ok":true`.

---

## T5.9: Redirect and canonical chain reports

### Goal

Screaming Frog's reports "Redirect Chains", "Redirect & Canonical Chains" and "Canonical Chains": one row per chain, with every hop, the final status and whether the chain loops. The crawl already stores `redirectChain` and `canonical`; this task follows them across pages.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src/lib/chains.ts` | `buildChains(pages)`: follows redirects, then canonicals, through `pageByUrl`; marks loops and chains leaving the crawl |
| `src/lib/issueExport.ts` or a new export | CSV with the source, hop 1..n, final URL, final status, a loop flag and the number of hops |
| `src/components/crawl-actions.tsx` | Export menu entries |

### Tests

- `chains.test.ts`: a two-hop redirect, a redirect to a canonicalised page, a canonical loop, a chain ending at a 404.

### Verify

- `npx vitest run src/lib/chains.test.ts` passes.

### Acceptance

- The fixture's `/loop-a` appears as a loop, and `/canonical-to-redirect.html` as a canonical-then-redirect chain.
- Gate `"ok":true`.

---

## T5.10: Readability

### Goal

Screaming Frog's Content filters "Readability Difficult" and "Readability Very Difficult" use the Flesch reading ease score (it reported `Fairly Hard` and a score of 58.2 for our fixture home page; see the Internal export columns). Add the score and both filters for English pages.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/parse.rs` | `sentence_count`, `syllable_count` from the body text (a vowel-group syllable heuristic) |
| `src/lib/readability.ts` | `fleschReadingEase(words, sentences, syllables)` and the band labels |
| `src/lib/filters.ts` | `readabilityDifficult` (score 30 to 50), `readabilityVeryDifficult` (below 30), only for pages whose `lang` starts with `en` or is missing |

### Tests

- Readability unit tests against known passages; parser counts; filter tests.

### Verify

- `cargo test` and `npx vitest run` pass.

### Acceptance

- The fixture home page scores within 5 points of Screaming Frog's 58.2.
- Gate `"ok":true`.

---

## T5.11: Sitemap source audits

### Goal

Screaming Frog's sitemap filters "URLs in Multiple Sitemaps", "XML Sitemap With Over 50k URLs" and "XML Sitemap Over 50MB". Also give sitemap-only URLs a depth that does not undercount `deepPage`: today they are queued at depth 0.

### Depends on

none

### Files

| Path | Purpose |
| --- | --- |
| `src-tauri/src/crawler/sitemap.rs` | Return each sitemap's URL, URL count and byte size with its locs |
| `src-tauri/src/crawler/crawl.rs` | `sitemap_sources: Vec<String>` on `PageResult`; queue sitemap-only URLs at depth `max_depth` so they are crawled but are not counted as shallow |
| `src/types.ts`, `SiteInfo` | Sitemap list with counts for `SiteInfoPanel` (a site-wide fact, not a page issue) |
| `src/lib/filters.ts` | Issue `inMultipleSitemaps` |

### Tests

- Fixture: a URL listed in both `sitemap.xml` and `sitemap-extra.xml` reports both sources.

### Verify

- `cargo test` passes.

### Acceptance

- Gate `"ok":true`.
