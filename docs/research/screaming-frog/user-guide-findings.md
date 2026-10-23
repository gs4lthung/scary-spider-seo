# Screaming Frog SEO Spider: research findings (primary sources only)

Researched 2026-10-22. All sources are screamingfrog.co.uk pages. Current version at time of research: **24.3 (29 June 2026)** ([release history](https://www.screamingfrog.co.uk/seo-spider/release-history/)). The product page says it audits "over 300 SEO issues" ([product page](https://www.screamingfrog.co.uk/seo-spider/)).

Source abbreviations used below:
- **[CFG]** https://www.screamingfrog.co.uk/seo-spider/user-guide/configuration/
- **[GEN]** https://www.screamingfrog.co.uk/seo-spider/user-guide/general/
- **[TABS]** https://www.screamingfrog.co.uk/seo-spider/user-guide/tabs/
- **[ISS]** https://www.screamingfrog.co.uk/seo-spider/issues/
- **[PROD]** https://www.screamingfrog.co.uk/seo-spider/
- **[PRICE]** https://www.screamingfrog.co.uk/seo-spider/pricing/
- **[FAQ]** https://www.screamingfrog.co.uk/seo-spider/faq/
- **[RH]** https://www.screamingfrog.co.uk/seo-spider/release-history/
- **[V20]** https://www.screamingfrog.co.uk/blog/seo-spider-20/
- **[V21]** https://www.screamingfrog.co.uk/blog/seo-spider-21/
- **[V22]** https://www.screamingfrog.co.uk/blog/seo-spider-22/
- **[V23]** https://www.screamingfrog.co.uk/blog/seo-spider-23/
- **[V24]** https://www.screamingfrog.co.uk/blog/seo-spider-24/
- **[DUP]** https://www.screamingfrog.co.uk/seo-spider/tutorials/how-to-check-for-duplicate-content/

Method note: the long guide pages were read through a fetch tool that summarises them, in 100k-character chunks. Filter and issue names below were requested verbatim. Wherever a page and a release note disagree, both are given.

---

## 1. How the crawler works

### Crawl modes
- **Spider** (default): crawls from a start URL. A Subdomain/Subfolder switcher limits scope. [GEN], [CFG]
- **List**: crawls a pasted or uploaded list (.txt, .xls, .xlsx, .csv, .xml; http/https only). Crawl depth defaults to 0, so only the uploaded URLs are checked. **Robots.txt is ignored by default in list mode.** A list-mode export keeps upload order, including duplicates. [CFG], [GEN]. v22 added uploading several XML sitemaps directly and using a Google Sheet as the source. [V22]
- **SERP**: upload titles and descriptions (headers `URL`, `Title`, `Description`; .txt/.csv/Excel) to compute pixel widths and character lengths without crawling. The SERP Summary report produces the upload format. [CFG], [GEN]
- **Compare**: diffs two crawls. Requires a licence and Database storage. Results fall into four change categories: **Added** (in both crawls, newly in the filter), **New** (only in the current crawl, in the filter), **Removed** (in both crawls, left the filter), **Missing** (only in the previous crawl, was in the filter). Elements are chosen under Config > Compare. [CFG]
- **APIs** (v22+): upload URLs and pull GA, GSC, PSI, Majestic, Ahrefs and Moz data without crawling. [CFG], [V22]

### Storage modes
- **Database** (default): crawls to disk, auto-saves, suits large crawls (default limit 5 million URLs, not a hard cap). Crawl comparison, change detection and segments **only work in this mode**. SSD recommended; HDDs, network drives and cloud-synced folders are not supported. [CFG]. The guide suggests about 4GB RAM for crawls up to about 2 million URLs. [GEN]
- **Memory (RAM)**: faster, generally for sites under about 500k URLs (8GB machine handles a couple of hundred thousand URLs). [CFG]. [GEN] says about 10k to 100k URLs at the 2GB default.
- Memory allocation defaults: 1GB (32-bit), 2GB (64-bit); set under File > Settings; restart required. [CFG], [GEN]
- Crawl retention (v23): automatically delete database crawls after a set period (default Never). Individual crawls or projects can be locked. [V23]
- Saved crawl formats: `.dbseospider` (recommended) or `.seospider`. [GEN]

### Rendering ([CFG] Spider > Rendering)
- Modes: **Text Only** (raw HTML), **Old AJAX Crawling Scheme** (deprecated), **JavaScript** (headless Chromium).
- AJAX timeout default 5s. Window size: mobile 411x731 by default, desktop 1024x768. Resize up to 8192px.
- Rendered page screenshots (configurable window, scaling, mobile/touch flags).
- JavaScript error reporting (console errors and warnings).
- Flatten Shadow DOM and Flatten iframes (both on by default).
- Archive Website: saves HTML and resources as a hierarchical archive or WARC (WARC since v21). [CFG], [V21]
- Store HTML and Store Rendered HTML (Spider > Extraction) enable source and text bulk exports, n-grams, AI prompts and embeddings. [CFG], [V20]

### Robots.txt ([CFG])
- **Respect robots.txt** (default), **Ignore robots.txt** (not downloaded), **Ignore robots.txt but report status** (downloaded, blocked URLs reported but still crawled).
- Show Internal/External URLs Blocked by Robots.txt toggles.
- **Custom Robots**: edit and test an override robots.txt per subdomain without changing the live file; tests against the selected user-agent.
- User-agent for robots.txt can be set separately from the HTTP user-agent.

### Crawl configuration ([CFG])
- **What to crawl** (Spider > Crawl), each with separate *store* and *crawl* toggles: Images, Media, CSS, JavaScript, SWF; Internal Hyperlinks; External Links; Canonicals; Pagination (rel next/prev); Hreflang (not crawled by default); AMP; Meta Refresh; iframes; Mobile Alternate. Also: Uncrawlable Links (store links Google cannot follow, e.g. `<a>` without href, `onclick`, `javascript:`; v24), Check Links Outside of Start Folder, Crawl Outside of Start Folder, Crawl All Subdomains, Follow Internal "Nofollow", Follow External "Nofollow" (nofollow, sponsored and ugc not followed by default), Crawl Invalid Links (v24), Crawl Linked XML Sitemaps (auto-discover via robots.txt or supply URLs). [CFG], [V24]
- **Extraction** (Spider > Extraction): Page Details (title, meta description, keywords, H1, H2, indexability, word count, readability, text-to-code ratio, hash, page size, forms, accessibility); URL Details (response time, Last-Modified, HTTP headers, cookies); Directives (meta robots, X-Robots-Tag); Structured Data (JSON-LD, Microdata, RDFa, with Schema.org and Google rich result validation); HTML storage; PDF (title, keywords, plus optional subject, author, dates, page count, word count, links).
- **Limits** (Spider > Limits): Limit Crawl Total (free 500; licensed default 5 million), Limit Crawl Depth, Limit URLs Per Crawl Depth, Limit Max Folder Depth, Limit Number of Query Strings, Limit Crawl Total Per Subdomain (v23), Max Redirects to Follow, Limit Max URL Length (default 10,000 chars), Max Links per URL to Crawl (default 10,000), Max Page Size (KB) to Crawl (default 50MB), Limit by URL Path (max pages per regex pattern). [CFG], [V23]
- **Advanced** (Spider > Advanced): Cookie Storage (Session Only default / Persistent / Do Not Store); Ignore Non-Indexable URLs for Issues; Ignore Paginated URLs for Duplicate Filters; Always Follow Redirects; Always Follow Canonicals (follow chains to the end in list mode, ignoring depth); Respect Noindex / Respect Canonical / Respect Next/Prev (hide from UI, still crawled); Respect HSTS Policy (shows 307); Respect Self Referencing Meta Refresh; Extract Images From IMG SRCSET; Crawl Fragment Identifiers; Perform HTML Validation; Green Hosting Carbon Calculation; Assume Pages are HTML; Response Timeout (default 20s); 5XX Response Retries.
- **Preferences** (Spider > Preferences): character and pixel thresholds for titles and meta descriptions; high internal/external outlink, high crawl depth and non-descriptive anchor text thresholds; URL, H1, H2, alt text lengths; max image size; low content word count. HTML and resource 2MB limits made configurable in v23.3. [CFG], [V23]
- **Include / Exclude**: regex. Include crawls only matching URLs (the start page must link to one). Exclude blocks matching URLs entirely; matched against the URL-encoded form. [CFG]
- **URL Rewriting**: Remove Parameters, Regex Replace, Lowercase discovered URLs, percent-encoding case (v23). [CFG], [V23]
- **CDNs**: treat listed domains or subfolders as internal. [CFG]
- **Speed**: threads (default 5) or Max URI/s. [CFG]
- **User-Agent**: own UA, presets (Googlebot, Bingbot, browsers), or custom; separate robots.txt UA. [CFG]
- **HTTP Header**: arbitrary custom request headers (e.g. Accept-Language, Cookie). [CFG]. Shopify web bot auth header presets added in 23.1. [V23]
- **Authentication**: Standards Based (Basic and Digest; auto-detected or pre-entered; **no licence needed**) and Forms Based (log in via built-in Chromium; **licence required**; warning that the crawler clicks every link, so logged-in crawls can trigger destructive actions). Authentication profiles can be exported encrypted (AES-256 GCM) for scheduled/CLI use. 2FA or expiring tokens may break forms login. [CFG]
- **Cookies**: see Cookie Storage above. Cookie extraction (URL Details) needs JS rendering for accuracy. [CFG]
- **Proxy**: one proxy for all HTTP/HTTPS traffic, restart required. [CFG]
- **Custom Search**: up to 100 "contains" / "does not contain" text or regex filters, over raw or rendered HTML (bulk add since v21). [CFG], [V21]
- **Custom Extraction**: up to 100 extractors (XPath 1.0 to 3.1, CSS Path, regex), up to 1,000 extractions; extract element, inner HTML, text or function value; visual selector builder (v19). [CFG], [V21], [RH]
- **Custom JavaScript**: Extraction and Action snippets run on internal 200 OK pages; library of presets. [CFG], [V20]
- **Content**: Content Area (elements/classes/IDs; body by default, nav and footer excluded); Duplicates; Spelling & Grammar; Embeddings; Custom Link Positions. [CFG]

### Canonical / redirect / hreflang following
- Canonicals, pagination, hreflang, AMP, meta refresh and iframes each have store vs crawl toggles. "Store" for canonicals only records the URL, it is not used for discovery. Hreflang URLs are not crawled unless "Crawl hreflang" is ticked. [CFG]
- Max Redirects to Follow limit; Always Follow Redirects / Always Follow Canonicals for list mode. [CFG]
- Redirect types reported: 3XX, Meta Refresh, HTTP Refresh (v23 filter), JavaScript. [TABS], [V23]

---

## 2. Tabs and their filters

### Top window tabs ([TABS] unless noted)

| Tab | Filters (verbatim) |
|---|---|
| **Internal** | HTML, JavaScript, CSS, Images, PDF, Flash, Other, Unknown. v20 added Media, Fonts and XML ([V20]). |
| **External** | Same as Internal. |
| **Security** | HTTP URLs, HTTPS URLs, Mixed Content, Form URL Insecure, Form on HTTP URL, Unsafe Cross-Origin Links, Protocol-Relative Resource Links, Missing HSTS Header, Missing Content-Security-Policy Header, Missing X-Content-Type-Options Header, Missing X-Frame-Options Header, Missing Secure Referrer-Policy Header, Bad Content Type |
| **Response Codes** | Blocked by Robots.txt, Blocked Resource, No Response, Success (2XX), Redirection (3XX), Redirection (JavaScript), Redirection (Meta Refresh), Redirection (HTTP Refresh), Redirect Chain, Redirect Loop, Client Error (4xx), Server Error (5XX). Split into Internal and External variants in the Issues tab ([ISS]). |
| **URL** | Non ASCII Characters, Underscores, Uppercase, Multiple Slashes, Repetitive Path, Contains A Space, Internal Search, Parameters, Broken Bookmark, GA Tracking Parameters, Over 115 characters |
| **Page Titles** | Missing, Duplicate, Over 60 characters, Below 30 characters, Over X Pixels, Below X Pixels, Same as h1, Multiple, Outside `<head>` |
| **Meta Description** | Missing, Duplicate, Over 155 characters, Below 70 characters, Over X Pixels, Below X Pixels, Multiple, Outside `<head>` |
| **Meta Keywords** | Missing, Duplicate, Multiple |
| **H1** | Missing, Duplicate, Over 70 characters, Multiple, Alt Text in h1, Non-sequential |
| **H2** | Missing, Duplicate, Over 70 characters, Multiple, Non-sequential |
| **Content** | Exact Duplicates, Near Duplicates, Low Content Pages, Soft 404 Pages, Spelling Errors, Grammar Errors, Readability Difficult, Readability Very Difficult, Lorem Ipsum Placeholder. Plus **Semantically Similar** and **Low Relevance Content** (v22; in [ISS] and [V22], not listed in the [TABS] text read). |
| **Images** | Over 100kb, Missing Alt Text, Missing Alt Attribute, Alt Text Over 100 Characters, Background Images, Missing Size Attributes, Incorrectly Sized Images |
| **Canonicals** | Contains Canonical, Self Referencing, Canonicalised, Missing, Multiple, Multiple Conflicting, Non-Indexable Canonical, Canonical Is Relative, Unlinked, Invalid Attribute In Annotation, Contains Fragment URL, Outside `<head>` |
| **Pagination** | Contains Pagination, First Page, Paginated 2+ Pages, Pagination URL Not In Anchor Tag, Non-200 Pagination URL, Unlinked Pagination URL, Non-Indexable, Multiple Pagination URLs, Pagination Loop, Sequence Error |
| **Directives** | Index, Noindex, Follow, Nofollow, None, NoArchive, NoSnippet, Max-Snippet, Max-Image-Preview, Max-Video-Preview, NoODP, NoYDIR, NoImageIndex, NoTranslate, Unavailable_After, Refresh, Outside `<head>` |
| **Hreflang** | Contains Hreflang, Non-200 Hreflang URLs, Unlinked Hreflang URLs, Missing Return Links, Inconsistent Language & Region Return Links, Non-Canonical Return Links, Noindex Return Links, Incorrect Language & Region Codes, Multiple Entries, Missing Self Reference, Not Using Canonical, Missing X-Default, Missing, Outside `<head>`. Sources: HTML, HTTP header and sitemap hreflang. |
| **JavaScript** | Pages with Blocked Resources, Contains JavaScript Links, Contains JavaScript Content, Noindex Only in Original HTML, Nofollow Only in Original HTML, Canonical Only in Rendered HTML, Canonical Mismatch, Page Title Only in Rendered HTML, Page Title Updated by JavaScript, Meta Description Only in Rendered HTML, Meta Description Updated by JavaScript, H1 Only in Rendered HTML, H1 Updated by JavaScript, Uses Old AJAX Crawling Scheme URLs, Uses Old AJAX Crawling Scheme Meta Fragment Tag, Pages with JavaScript Errors |
| **Links** | Pages With High Crawl Depth, Pages Without Internal Outlinks, Internal Nofollow Outlinks, Internal Outlinks With No Anchor Text, Non-Descriptive Anchor Text In Internal Outlinks, Pages With High External Outlinks, Pages With High Internal Outlinks, Follow & Nofollow Internal Inlinks To Page, Internal Nofollow Inlinks Only, Outlinks To Localhost, Non-Indexable Page Inlinks Only. Plus **Pages With Uncrawlable Internal Outlinks** (v24, [V24], [ISS]). |
| **AMP** | SEO: Non-200 Response, Missing Non-AMP Return Link, Missing Canonical to Non-AMP, Non-Indexable Canonical, Indexable, Non-Indexable. AMP: Missing HTML AMP Tag, Missing/Invalid Doctype HTML Tag, Missing Head Tag, Missing Body Tag, Missing Canonical, Missing/Invalid Meta Charset Tag, Missing/Invalid Meta Viewport Tag, Missing/Invalid AMP Script, Missing/Invalid AMP Boilerplate, Contains Disallowed HTML, Other Validation Errors |
| **Structured Data** | Contains Structured Data, Missing Structured Data, Validation Errors, Validation Warnings, Parse Errors, Microdata URLs, JSON-LD URLs, RDFa URLs. Rich Result Validation Errors/Warnings exist as issues ([ISS]); Google rich-result validation was split from Schema.org in v20 ([V20]). |
| **Sitemaps** | URLs In Sitemap, URLs Not In Sitemap, Orphan URLs, Non-Indexable URLs in Sitemap, URLs In Multiple Sitemaps, XML Sitemap With Over 50k URLs, XML Sitemap With Over 50mb |
| **PageSpeed** | Document Request Latency, LCP Request Discovery, Render Blocking Requests, Network Dependency Tree, Use Efficient Cache Lifetimes, Layout Shift Culprits, Improve Image Delivery, Forced Reflow, Legacy JavaScript, Duplicated JavaScript, Avoid Enormous Network Payloads, Minify CSS, Minify JavaScript, Reduce Unused CSS, Reduce Unused JavaScript, Reduce JavaScript Execution Time, Minimize Main-Thread Work, Optimize DOM Size, Font Display (Lighthouse 13 Insight audits since v23, [V23]). Columns include CrUX field data, Lighthouse lab data, PSI Status, PSI Error. |
| **Mobile** | Viewport Not Set, Target Size, Content Not Sized Correctly, Illegible Font Size, Unsupported Plugins, Mobile Alternate Link (from PSI or local Lighthouse, [V20]) |
| **Accessibility** | Overview: Accessibility Score Poor, Accessibility Score Needs Improvement, Accessibility Score Good. Then about 90 axe-core rule filters grouped as Best Practice, WCAG 2.0 A, WCAG 2.0 AA, WCAG 2.0 AAA, WCAG 2.1 AA, WCAG 2.2 AA (full list in section 3). Requires JS rendering ([V21]). |
| **Custom Search** | One dynamic filter per configured search ("Contains: [x]" / "Does Not Contain: [y]") |
| **Custom Extraction** | One dynamic filter per extractor |
| **Custom JavaScript** | One dynamic filter per Extraction-type snippet |
| **Analytics** (GA4) | Sessions Above 0, Bounce Rate Above 70%, No GA Data, Non-Indexable with GA Data, Orphan URLs |
| **Search Console** | Clicks Above 0, No Search Analytics Data, Non-Indexable with Search Analytics Data, Orphan URLs, URL Is Not on Google, Indexable URL Not Indexed, URL is on Google But Has Issues, User-Declared Canonical Not Selected, Page Is Not Mobile Friendly, AMP URL Is Invalid, Rich Result Invalid. URL Inspection columns: Summary, Coverage, Last Crawl, Crawled As, Crawl Allowed, Indexing Allowed, Google-Selected Canonical, Mobile Usability, AMP Results, Rich Results. |
| **Validation** | Invalid HTML Elements In `<head>`, `<body>` Element Preceding `<html>`, `<head>` Not First In `<html>` Element, Missing `<head>` Tag, Multiple `<head>` Tags, Missing `<body>` Tag, Multiple `<body>` Tags, HTML Document Over 2MB, Resource Over 2mb, High Carbon Rating |
| **Link Metrics** | No filters listed; Majestic, Ahrefs and Moz metric columns. |
| **AI** | One dynamic filter per prompt. |
| **Change Detection** (Compare mode) | Indexability, Page Titles, Meta Description, H1, Word Count, Crawl Depth, Inlinks, Unique Inlinks, Internal Outlinks, Unique Internal Outlinks, External Outlinks, Unique External Outlinks, Structured Data Unique Types, Content (content changed by more than 10% by default, or the Config > Compare threshold). |

Internal tab key columns ([TABS]): Address, Content, Status Code, Status, Indexability, Indexability Status, Title 1 + Length + Pixel Width, Meta Description 1 + Length + Pixel Width, Meta Keyword 1, h1-1, h2-1, Meta Robots 1, X-Robots-Tag 1, Meta Refresh 1, Canonical Link Element, rel next/prev (HTML and HTTP), Size, Transferred, Total Transferred, Word Count, Text Ratio, Crawl Depth, Folder Depth, Link Score, Inlinks, Unique Inlinks, Unique JS Inlinks, % of Total, Outlinks, Unique Outlinks, Unique JS Outlinks, External Outlinks, Unique External Outlinks, Unique External JS Outlinks, Closest Similarity Match, No. Near Duplicates, Spelling Errors, Grammar Errors, Language, Hash, Response Time, Last-Modified, Redirect URI, Redirect Type, HTTP Version, URL Encoded Address. Content tab adds Average Words Per Sentence, Flesch Reading Ease Score, Readability.

### Right-hand pane tabs ([TABS])
Overview, Issues, Site Structure, Segments, Response Times, API, Spelling & Grammar, Semantic Search (with "Embedding Display" filter and Centroid option, v22).

### Lower-window tabs (per selected URL) ([TABS])
URL Details, Inlinks, Outlinks, Image Details, Duplicate Details, Resources, SERP Snippet, Rendered Page (blocked resources / all resources filter), View Source (original vs rendered), HTTP Headers, Cookies, Structured Data Details, Lighthouse Details, Accessibility Details, Spelling & Grammar Details, N-grams. Inlinks/Outlinks have an Anchors aggregate view (v20) and Outlinks has a Link Crawlability column (v24). [V20], [V24]

---

## 3. Issues library ([ISS], each issue also has its own page under https://www.screamingfrog.co.uk/seo-spider/issues/<tab>/<slug>/)

Format: Name (Type, Priority).

### Response Codes
- Internal No Response (Issue, High)
- Internal Client Error (4XX) (Issue, High)
- Internal Server Error (5XX) (Issue, High)
- Internal Redirect Loop (Issue, High)
- Internal Blocked by Robots.txt (Warning, High)
- Internal Blocked Resource (Warning, High)
- Internal Redirect Chain (Warning, Medium)
- External Blocked Resource (Warning, Medium)
- Internal Redirection (3XX) (Warning, Low)
- Internal Redirection (Meta Refresh) (Warning, Low)
- Internal Redirection (HTTP Refresh) (Warning, Low)
- Internal Redirection (JavaScript) (Warning, Low)
- External No Response (Warning, Low)
- External Client Error (4XX) (Warning, Low)
- External Server Error (5XX) (Warning, Low)

### Security
- HTTP URLs (Issue, High)
- Mixed Content (Issue, High)
- Form URL Insecure (Issue, High)
- Form On HTTP URL (Issue, High)
- Missing HSTS Header (Warning, Low)
- Unsafe Cross Origin Links (Warning, Low)
- Protocol-Relative Resource Links (Warning, Low)
- Missing Content-Security-Policy Header (Warning, Low)
- Missing X-Content-Type-Options Header (Warning, Low)
- Missing X-Frames-Options Header (Warning, Low)
- Missing Secure Referrer-Policy Header (Warning, Low)
- Bad Content Type (Warning, Low)

### URL
- Multiple Slashes (Issue, Low)
- Contains A Space (Issue, Low)
- Broken Bookmark (Issue, Low)
- Non ASCII Characters (Warning, Low)
- Uppercase (Warning, Low)
- Repetitive Path (Warning, Low)
- Internal Search (Warning, Low)
- Parameters (Warning, Low)
- GA Tracking Parameters (Warning, Low)
- Underscores (Opportunity, Low)
- Over 115 Characters (Opportunity, Low)

### Page Titles
- Missing (Issue, High)
- Multiple (Issue, High)
- Outside `<head>` (Issue, High)
- Duplicate (Opportunity, Medium)
- Over 60 Characters (Opportunity, Medium)
- Below 30 Characters (Opportunity, Medium)
- Over 561 Pixels (Opportunity, Medium)
- Below 200 Pixels (Opportunity, Medium)
- Same as H1 (Opportunity, Low)

### Meta Description
- Multiple (Issue, Medium)
- Outside `<head>` (Issue, Medium)
- Missing (Opportunity, Low)
- Duplicate (Opportunity, Low)
- Over 155 Characters (Opportunity, Low)
- Below 70 Characters (Opportunity, Low)
- Over 985 Pixels (Opportunity, Low)
- Below 400 Pixels (Opportunity, Low)

### H1
- Missing (Issue, Medium)
- Multiple (Warning, Medium)
- Alt Text in h1 (Warning, Low)
- Non-sequential (Warning, Low)
- Duplicate (Opportunity, Low)
- Over 70 Characters (Opportunity, Low)

### H2
- Missing (Warning, Low)
- Multiple (Warning, Low)
- Non-sequential (Warning, Low)
- Duplicate (Opportunity, Low)
- Over 70 Characters (Opportunity, Low)

### Content
- Exact Duplicates (Issue, High)
- Spelling Errors (Issue, Medium)
- Grammar Errors (Issue, Medium)
- Soft 404 Pages (Warning, High)
- Lorem Ipsum Placeholder (Warning, High)
- Near Duplicates (Warning, Medium)
- Semantically Similar (Warning, Medium)
- Low Relevance Content (Warning, Low)
- Low Content Pages (Opportunity, Medium)
- Readability Difficult (Opportunity, Low)
- Readability Very Difficult (Opportunity, Low)

### Images
- Missing Alt Text (Issue, Low)
- Missing Alt Attribute (Issue, Low)
- Background Images (Warning, Low)
- Over 100 kb (Opportunity, Medium)
- Alt Text Over 100 Characters (Opportunity, Low)
- Incorrectly Sized Images (Opportunity, Low)
- Missing Size Attributes (Opportunity, Low)

### Canonicals
- Multiple Conflicting (Issue, High)
- Non-Indexable Canonical (Issue, High)
- Invalid Attribute In Annotation (Issue, High)
- Contains Fragment URL (Issue, High)
- Outside `<head>` (Issue, High)
- Canonicalised (Warning, High)
- Missing (Warning, Medium)
- Unlinked (Warning, Medium)
- Multiple (Warning, Low)
- Canonical Is Relative (Warning, Low)

### Pagination
- Pagination URL Not In Anchor Tag (Issue, High)
- Non-200 Pagination URLs (Issue, High)
- Unlinked Pagination URLs (Issue, Medium)
- Multiple Pagination URLs (Issue, Low)
- Pagination Loop (Issue, Low)
- Sequence Error (Issue, Low)
- Non-Indexable (Warning, High)

### Directives
- Outside `<head>` (Issue, High)
- NoImageIndex (Issue, Low)
- Noindex (Warning, High)
- Nofollow (Warning, High)
- None (Warning, High)
- Unavailable_After (Warning, Medium)
- NoSnippet (Warning, Low)
- NoODP (Warning, Low)
- NoYDIR (Warning, Low)
- NoTranslate (Warning, Low)

### Hreflang
- Non-200 Hreflang URLs (Issue, High)
- Missing Return Links (Issue, High)
- Inconsistent Language & Region Confirmation Links (Issue, High)
- Non-Canonical Return Links (Issue, High)
- Noindex Returns Links (Issue, High) (spelling as on the page)
- Incorrect Language & Region Codes (Issue, High)
- Multiple Entries (Issue, High)
- Not Using Canonical (Issue, High)
- Outside `<head>` (Issue, High)
- Unlinked Hreflang URLs (Issue, Medium)
- Missing Self Reference (Warning, Low)
- Missing X-Default (Warning, Low)

### JavaScript
- Noindex Only in Original HTML (Issue, High)
- Nofollow Only in Original HTML (Issue, High)
- Canonical Mismatch (Issue, High)
- Uses Old AJAX Crawling Scheme URLs (Issue, Medium)
- Uses Old AJAX Crawling Scheme Meta Fragment Tag (Issue, Medium)
- Pages with Blocked Resources (Warning, High)
- Contains JavaScript Links (Warning, Medium)
- Contains JavaScript Content (Warning, Medium)
- Page Title Only in Rendered HTML (Warning, Medium)
- Page Title Updated by JavaScript (Warning, Medium)
- Meta Description Only in Rendered HTML (Warning, Medium)
- Meta Description Updated by JavaScript (Warning, Medium)
- H1 Only in Rendered HTML (Warning, Medium)
- H1 Updated by JavaScript (Warning, Medium)
- Canonical Only in Rendered HTML (Warning, Low)
- Pages With JavaScript Errors (Warning, Low)

### Links
- Outlinks To Localhost (Issue, High)
- Pages With Uncrawlable Internal Outlinks (Warning, High)
- Pages Without Internal Outlinks (Warning, High)
- Non-Indexable Page Inlinks Only (Warning, High)
- Internal Nofollow Outlinks (Warning, Low)
- Pages With High External Outlinks (Warning, Low)
- Pages With High Internal Outlinks (Warning, Low)
- Follow & Nofollow Internal Inlinks To Page (Warning, Low)
- Internal Nofollow Inlinks Only (Warning, Low)
- Pages With High Crawl Depth (Opportunity, Medium)
- Internal Outlinks With No Anchor Text (Opportunity, Low)
- Non-Descriptive Anchor Text In Internal Outlinks (Opportunity, Low)

### AMP
- Non-200 Response (Issue, High)
- Missing Non-AMP Return Link (Issue, High)
- Missing Canonical to Non-AMP (Issue, High)
- Non-Indexable Canonical (Issue, High)
- Missing `<html amp>` Tag (Issue, High)
- Missing/Invalid Doctype HTML Tag (Issue, High)
- Missing Head Tag (Issue, High)
- Missing Body Tag (Issue, High)
- Missing Canonical (Issue, High)
- Missing/Invalid Meta Charset Tag (Issue, High)
- Missing/Invalid Meta Viewport Tag (Issue, High)
- Missing/Invalid AMP Script (Issue, High)
- Missing/Invalid AMP Boilerplate (Issue, High)
- Contains Disallowed HTML (Issue, High)
- Other Validation Errors (Issue, High)
- Indexable (Warning, High)

### Structured Data
- Validation Errors (Issue, High)
- Rich Result Validation Errors (Issue, High)
- Parse Errors (Issue, High)
- Missing (Opportunity, Low)
- Validation Warnings (Opportunity, Low)
- Rich Result Validation Warnings (Opportunity, Low)

### Sitemaps
- XML Sitemap With Over 50k URLs (Issue, High)
- XML Sitemap Over 50mb (Issue, High)
- URLs Not In Sitemap (Issue, Medium)
- Orphan URLs (Issue, Medium)
- Non-Indexable URLs In Sitemap (Issue, Medium)
- URLs In Multiple Sitemaps (Warning, Low)

### PageSpeed (all Opportunity)
- Document Request Latency (Medium)
- LCP Request Discovery (Medium)
- Render Blocking Requests (Medium)
- Network Dependency Tree (Medium)
- Use Efficient Cache Lifetimes (Medium)
- Layout Shift Culprits (Medium)
- Improve Image Delivery (Medium)
- Forced Reflow (Medium)
- Legacy JavaScript (Medium)
- Duplicated JavaScript (Medium)
- Avoid Enormous Network Payloads (Medium)
- Minify CSS (Medium)
- Minify JavaScript (Medium)
- Reduce Unused CSS (Medium)
- Reduce Unused JavaScript (Medium)
- Reduce JavaScript Execution Time (Medium)
- Minimize Main-Thread Work (Medium)
- Optimize DOM Size (Low)
- Font Display (Low)

### Mobile
- Viewport Not Set (Issue, High)
- Content Not Sized Correctly (Issue, High)
- Illegible Font Size (Issue, High)
- Contains Unsupported Plugins (Issue, High)
- Target Size (Issue, Medium)
- Mobile Alternate Link (Warning, High)

### Accessibility (all Warning; priority from axe impact)
High:
- Best Practice: Accesskey Attribute Value Must Be Unique; Elements Must Not Have Tabindex Greater Than Zero; ARIA Dialog & Alertdialog Require Accessible Name; ARIA Treeitem Nodes Require Accessible Name; Role=text Should Have No Focusable Descendants; Form Elements Should Have Visible Label; Frames Should Be Tested With axe-core; Scope Attribute Should Be Used Correctly On Tables
- WCAG 2.0 A: Scrollable Region Requires Keyboard Access; Required ARIA Attributes Must Be Provided; ARIA Attribute Must Be Used As Specified For Role; ARIA Attributes Require Valid Values; ARIA Attributes Require Valid Names; ARIA Commands Require Accessible Name; ARIA Input Fields Require Accessible Name; ARIA Meter Nodes Require Accessible Name; ARIA Progressbar Nodes Require Accessible Name; ARIA Roles Must Be Contained By Required Parent; ARIA Roles Require Valid Values; ARIA Toggle Fields Require Accessible Name; ARIA Tooltip Nodes Require Accessible Name; Certain ARIA Roles Must Contain Specific Children; Aria-braille Require Non-braille Equivalent; Aria-hidden Elements Contains Focusable Elements; Aria-hidden=true Must Not Be Used In `<body>`; Elements Must Only Use Permitted ARIA Attributes; Elements Must Use Allowed ARIA Attributes; IDs Used In ARIA & Labels Must Be Unique; Page Requires Means To Bypass Repeated Blocks; Form `<input>` Elements Require Labels; Frames Require Title Attribute; Frames Require Unique Title Attribute; Frames With Focusable Content Must Not Use tabindex=-1; Page Must Contain `<title>`; HTML Element Lang Attribute Value Must Be Valid; HTML Element Requires Lang Attribute; Image Button Requires Alternate Text; Images Require Alternate Text; `<object>` Elements Require Alternate Text; Active `<area>` Elements Require Alternate Text; Elements Marked role=img Require Alternate Text; SVG Images & Graphics Require Accessible Text; `<video>` Elements Require `<track>` For Captions; `<video>` or `<audio>` Elements Must Not Auto-play; Buttons Require Discernible Text; Input Buttons Require Discernible Text; Links Require Discernible Text; Links Must Be Distinguishable; Select Element Requires Accessible Name; Summary Elements Require Discernible Text (priority not visible in the read, presumed High by position: **unverified**); Deprecated `<marquee>` Element Must Not Be Used; Interactive Controls Must Not Be Nested; List Items Must Be Contained In List Elements; Lists Must Only Contain `<li>` Content Elements; `<dt>` & `<dd>` Elements Must Be Contained by `<dl>`; `<dl>` Must Only Have Ordered `<dt>` & `<dd>` Groups; `<blink>` Elements Deprecated & Must Not Be Used; `<th>` Element Requires Associated Data Cells; Table Header Attr Must Refer To Cell In Same Table
- WCAG 2.0 AA: Meta Viewport Zoom & Scaling Disabled; Lang Attribute Requires Valid Value; Text Requires Higher Color Contrast to Background
- WCAG 2.0 AAA: Text Requires Higher Color Contrast Ratio
- WCAG 2.1 AA: Autocomplete Attribute Must Be Used Correctly; Inline Text Spacing Must Be Adjustable
- WCAG 2.2 AA: Touch Targets Require Sufficient Size & Spacing

Medium:
- Best Practice: Skip-link Target Should Exist & Be Focusable; All Page Content Must Be Contained By Landmarks; Page Requires One Main Landmark; Page Must Not Have More Than One Banner Landmark; Banner Landmark Must Not Be In Another Landmark; Page Must Not Have Multiple Contentinfo Landmarks; Page Requires At Most One Main Landmark; Complementary Landmarks & Asides Must Be Top Level; Contentinfo Landmark Must Be Top Level Landmark; Main Landmark Must Not Be In Another Landmark; Landmarks Require Unique Role Or Accessible Name; Page Must Contain `<h1>`; Heading Levels Should Only Increase By One
- WCAG 2.0 A: Form Field Must Not Have Multiple Label Elements; HTML Lang & XML Lang Value Should Match

Low:
- Best Practice: Ensure Elements Marked Presentational Are Ignored; ARIA Role Should Be Appropriate For Element; Headings Should Not Be Empty; Meta Viewport Should Allow Zoom & Scale Up to 500%; Alt Text Should Not Be Repeated As Text; Table Headers Require Discernible Text; Table With Identical Summary & Caption Text
- WCAG 2.0 A: Deprecated ARIA Roles Must Not Be Used; Server-Side Image Maps Must Not Be Used
- WCAG 2.0 AAA: Delayed Meta Refresh Must Not Be Used; Links With Same Accessible Name

Note: the [TABS] WCAG 2.0 A filter list also includes "Timed Meta Refresh Must Not Exist", which was not seen in the issues library read.

### Analytics
- Orphan URLs (Issue, Medium)
- Bounce Rate Above 70% (Warning, Low)
- No GA Data (Warning, Low)
- Non-Indexable with GA Data (Warning, Low)

### Search Console
- Page is Not Mobile Friendly (Issue, High)
- Orphan URLs (Issue, Medium)
- URL is on Google, But Has Issues (Issue, Medium)
- AMP URL is Invalid (Issue, Medium)
- Rich Result is Invalid (Issue, Medium)
- Indexable URL Not Indexed (Warning, High)
- User-Declared Canonical Not Selected (Warning, Medium)
- No Search Analytics Data (Warning, Low)
- Non-Indexable with Search Analytics Data (Warning, Low)
- URL Is Not on Google (Warning, Low)

### Validation
- Missing `<head>` Tag (Issue, High)
- Multiple `<head>` Tags (Issue, High)
- Missing `<body>` Tag (Issue, High)
- Multiple `<body>` Tags (Issue, High)
- HTML Document Over 2MB (Issue, High) (threshold configurable since 23.3, [V23])
- Resource Over 2MB (Issue, High)
- Invalid HTML Elements In `<head>` (Warning, High)
- `<body>` Element Preceding `<html>` (Warning, High)
- `<head>` Not First In `<html>` Element (Warning, High)
- High Carbon Rating (Opportunity, Low)

---

## 4. Analysis features

- **Crawl Analysis** (post-crawl): runs automatically at the end of a crawl or via Crawl Analysis > Start. Required for Link Score, Near Duplicates, Semantically Similar / Low Relevance, Sitemaps filters (with Crawl Linked XML Sitemaps), GA/GSC Orphan URLs (with "crawl new URLs discovered"), and others. [CFG], [TABS], [V22]. The full list of crawl-analysis-dependent filters was not read in full (**partly unverified**). The Images tab's Background Images and Incorrectly Sized Images need JS rendering and crawl analysis. [TABS]
- **Link Score**: "A metric between 0-100, which calculates the relative value of a page based upon its internal links", "similar to Google's own PageRank"; populated by crawl analysis. [TABS]. The exact formula is not documented on the pages read (**unverified**).
- **Crawl Depth**: clicks from the start page; redirects count as a level. Folder Depth is a separate column. [TABS]
- **Duplicates**: exact duplicates use an MD5 hash of the full HTML. Near duplicates use **minhash** on page text (content area), default **90%** similarity, adjustable; enable via Config > Content > Duplicates and run crawl analysis; threshold and content area can be changed and re-analysed without recrawling; indexable pages only. [DUP], [CFG]
- **Semantic similarity / embeddings** (v22+): LLM embeddings from OpenAI, Gemini or Ollama (Config > Content > Embeddings, needs Store HTML and an API key). Cosine similarity 0 to 1, default threshold 0.95 (down to 0.5). "Low Relevance Content" compares each page with the site-wide embedding centroid. Content Cluster Diagram visualisation (2D, dimension reduction and clustering configurable). Semantic Search tab (query vs page embeddings; minimum score since 22.2). Embedding rules by URL pattern (v23), e.g. for redirect mapping. [V22], [V23], [CFG]
- **Spelling & Grammar**: off by default; 40 languages (Irish added v23); custom dictionary, ignore lists, grammar rule controls. [CFG], [V23]
- **Readability**: Flesch Reading Ease, average words per sentence, Readability Difficult / Very Difficult filters. [TABS]
- **Inlinks / Outlinks**: lower-window tabs with anchor text and link details; aggregated Anchors view (v20); Link Crawlability column (v24); "Show Link In Browser/HTML" (v21). [TABS], [V20], [V21], [V24]
- **Link position**: Custom Link Positions classify links into navigation, content, footer and so on, by link path substrings (can be disabled to save memory). [CFG]
- **N-grams** (v20): phrase frequency per page or aggregated; needs Store HTML. [V20]
- **Visualisations**: Force-Directed Crawl Diagram, 3D Force-Directed Crawl Diagram, Crawl Tree Graph, Force-Directed Directory Tree Diagram, 3D Force-Directed Directory Tree Diagram, Directory Tree Graph, Inlink Anchor Text Word Cloud, Body Text Word Cloud, Content Cluster Diagram. Show inlinks/outlinks on node right-click (v23). [GEN], [V23]
- **Crawl comparison / change detection**: Compare mode (see section 1), Change Detection tab, URL mapping between crawls (e.g. staging vs live; the mapping config was not read in detail, **unverified**). Auto Compare Crawls for scheduled/CLI crawls (v24). [CFG], [V24]
- **Scheduling**: File > Scheduling with interval, mode, config and API settings; exports need headless mode; each scheduled crawl is a new instance; history log. Email notifications (v21), crawl changes and export attachments in emails (v24). [GEN], [V21], [V24]
- **CLI / headless**: config via files in `.ScreamingFrogSEOSpider` (licence.txt, spider.config); `--load-crawl` with DB crawl ID and `--list-crawls` (v21). [GEN], [V21]
- **Exports**: tab exports respect the current filter; lower-window exports; **Bulk Export** menu (Queued URLs; Links: All Inlinks, All Outlinks, All Anchor Text, External Links, Internal Nofollow Outlinks, Internal Outlinks With No Anchor Text, Non-Descriptive Anchor Text In Internal Outlinks, Follow & Nofollow Internal Inlinks To Page, Internal Nofollow Inlinks Only, Outlinks to Localhost; Web: Screenshots, Archived Website, All Page Source, All Page Text, All PDF Documents, All PDF Content, All HTTP Request Headers, All HTTP Response Headers, All Cookies; Path Type; Security; Response Codes; Content; Images; Canonicals; Directives; JavaScript; AMP; Structured Data; Sitemaps; Custom Search; Custom Extraction; URL Inspection; Accessibility; Issues; AI). "All Error Inlinks" (v23) and "Non-Indexable Page Inlinks Only" (23.3) exports. **Multi-Export** with saved presets (v22). Formats: CSV, Excel, Google Sheets (5m cell limit); multiple tabs into one workbook (v22). [GEN], [V22], [V23]
- **Reports** (Reports menu): Crawl Overview; All Redirects; Redirect Chains; Redirect & Canonical Chains; Redirects to Errors (v23); Canonicals (Canonical Chains, Non-Indexable Canonicals); Pagination (Non-200 Pagination URLs, Unlinked Pagination URLs); Hreflang (All Hreflang URLs, Non-200 Hreflang URLs, Unlinked Hreflang URLs, Missing Return Links, Inconsistent Language & Region Return Links, Non Canonical Return Links, Noindex Return Links); Insecure Content; SERP Summary; Orphan Pages (needs GA, GSC or sitemap crawl); Structured Data (Validation Errors & Warnings Summary, Validation Errors & Warnings, Google Rich Results Features Summary, Google Rich Results Features); PageSpeed (PageSpeed Opportunities Summary, CSS Coverage Summary, JavaScript Coverage Summary); JavaScript (Chrome Console Log Summary); Mobile; Accessibility (Accessibility Violations Summary); HTTP Header Summary; Cookie Summary. Crawl Path Report via right-click > Export. [GEN], [V23]. Looker Studio (renamed back to Data Studio in v24) crawl reports from scheduled crawls and multi-export. [PROD], [V22], [V24]
- **XML sitemap generation**: XML Sitemap and Images Sitemap; HTML 200 pages by default, optionally noindex, canonicalised, paginated, PDFs; lastmod (server response or custom date), priority, changefreq (from Last-Modified or crawl depth); images incl. CDN-hosted with minimum inlink filter; sitemap index created above 49,999 URLs. Segmented sitemaps via segments. [GEN], [CFG]
- **API integrations** (Config > API Access): Google Analytics 4 (sessions, engagement, conversions, revenue; trailing slash/case matching; top 100,000 by default; crawl GA-only URLs); Google Search Console (Search Analytics, last 30 days default; URL Inspection 2,000 URLs per property per day); PageSpeed Insights (remote: 25,000 queries/day, 60 per 100s, CrUX; local Lighthouse: no CrUX, no daily cap); Majestic (access token); Ahrefs (API v3, OAuth "Sign in with Ahrefs", v23); Moz (API v3 since v22). "Request API Data" while paused; right-click per-URL API fetch (v22). [CFG], [V22], [V23]
- **Segments** (v19, database mode only): rules over any crawl data including GA/GSC and Issues; precedence ordering; used in visualisations, segmented XML sitemaps, Looker/Data Studio reports, AI prompt targeting ("Match on Segment"). [CFG], [RH], [V22]
- **AI / LLM integrations**: v20 Custom JavaScript snippets (e.g. call OpenAI or local Ollama/LLaVa). v21 direct API integration with OpenAI, Gemini, Ollama: up to 100 prompts, inputs body text / HTML / custom extraction, prompt library, AI tab. v22 Anthropic built in, custom OpenAI-compatible endpoint, image and text-to-speech generation, segment targeting. v23 defaults gpt-5-mini, gemini-2.5-flash, claude-sonnet-4-5. v24 live model validation, system-wide prompt, token usage display, Ollama image generation. **MCP server** (v24, licence only): run crawls, analyse and export data from AI assistants such as Claude; auto-start option in 24.1. [V20], [V21], [V22], [V23], [V24], [FAQ]
- **Accessibility**: axe-core (Deque) rules, needs JS rendering, WCAG 2.0 A/AA/AAA, 2.1 AA, 2.2 AA; Accessibility Details tab; per-page score via Lighthouse/PSI. axe engine updated in 24.2. [V21], [V24]
- **Carbon footprint** (v20): CO2.js, Sustainable Web Design Model, per-URL rating, High Carbon Rating opportunity. [V20]
- **Other**: Find uncrawlable links (v24); Usage Stats (v24); Focus Mode, column configurator, regex search over columns. [V24], [V22], [GEN]

### Version headlines (19 to 24) [RH]
- **19.0** (17 Jul 2023): updated design, unified configuration, segments, visual custom extraction, 3D visualisations, new filters/issues.
- **20.0** (7 May 2024): custom JavaScript snippets, mobile usability, n-grams, aggregated anchor text, local Lighthouse, carbon footprint.
- **21.0** (12 Nov 2024): AI API integration (OpenAI, Gemini, Ollama), accessibility, email notifications, custom search bulk upload.
- **22.0** (10 Jun 2025): semantic similarity, content cluster visualisation, semantic search, AI improvements, column configurator, multi-export, APIs mode.
- **23.0** (20 Oct 2025): Lighthouse 13 Insight audits, Ahrefs v3, crawl retention, embedding rules, links in visualisations.
- **24.0** (19 May 2026): MCP server, auto compare crawls, crawl changes and attachments in emails, find uncrawlable links, usage stats, Arm64 Linux. Latest: 24.3 (29 Jun 2026).

---

## 5. Free vs paid

- Free: **500 URLs per crawl** (list mode also limited to 500). Paid: "Unlimited*", where the maximum depends on allocated memory and storage; default Limit Crawl Total 5 million. [PROD], [PRICE], [CFG], [FAQ]
- Licence unlocks: saving and opening crawls, configuration options, custom source code search, custom extraction, GA, GSC and PSI integrations, JavaScript rendering, configuration profiles, scheduling. [GEN], [FAQ]. Also licence-only: Compare mode (database mode) [CFG], forms-based authentication [CFG], MCP server [FAQ]. Standards-based authentication works without a licence. [CFG]
- On expiry, the tool reverts to the free version: config unavailable, 500 URL limit, saved crawls cannot be opened. [FAQ]
- Price: [PRICE] (USD view) $279/yr for 1 to 4 licences, $265 (5 to 9), $249 (10 to 19), $235 (20+); per user, 1 year. [PROD] shows EUR 245/yr; [GEN]/[FAQ] prose says GBP 199/yr (currency or page-age differences).
- Inconsistency: the free/paid comparison tables on [PROD] and [PRICE], as text-extracted, list the same features for both and only differ on the crawl limit (the tick/cross icons likely did not survive extraction). The restrictions above come from prose on [PROD], [GEN] and [FAQ]. Per-feature restrictions beyond those listed are **unverified**.
