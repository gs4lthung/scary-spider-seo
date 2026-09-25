use scraper::{Html, Selector};
use serde_json::Value;
use std::sync::LazyLock;
use url::Url;

// Compiled once and reused across every crawled page instead of re-parsing the
// same selector strings on every call to `parse_page`.
static LD_JSON_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse(r#"script[type="application/ld+json"]"#).unwrap());
static REMOVE_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse("script, style, noscript, template").unwrap());
static TITLE_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("title").unwrap());
static META_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("meta").unwrap());
static H1_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("h1").unwrap());
static CANONICAL_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse(r#"link[rel="canonical"]"#).unwrap());
static HTML_TAG_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("html").unwrap());
static HREFLANG_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse(r#"link[rel="alternate"][hreflang]"#).unwrap());
static BODY_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("body").unwrap());
static A_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("a[href]").unwrap());
static IMG_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("img[src]").unwrap());

pub struct ParsedPage {
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub meta_robots: Option<String>,
    pub h1: Option<String>,
    pub h1_count: usize,
    pub word_count: usize,
    pub canonical: Option<String>,
    pub canonical_count: usize,
    pub internal_links: Vec<Url>,
    pub external_links: Vec<Url>,
    pub images: Vec<(Url, Option<String>)>,
    pub html_size_bytes: usize,
    pub minify_savings_pct: f64,
    pub is_minified: bool,
    pub insecure_link_count: usize,
    pub missing_alt_count: usize,
    pub lang: Option<String>,
    pub hreflang_values: Vec<String>,
    pub internal_nofollow_count: usize,
    pub text_ratio_pct: f64,
    pub content_hash: String,
    pub viewport: Option<String>,
    pub has_open_graph: bool,
    pub has_twitter_card: bool,
    pub structured_data_types: Vec<String>,
    pub structured_data_errors: Vec<String>,
}

/// Walks a parsed JSON-LD value collecting every `@type` found, including
/// inside a `@graph` array or a top-level array of multiple entities.
fn collect_schema_types(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_schema_types(item, out);
            }
        }
        Value::Object(map) => {
            if let Some(graph) = map.get("@graph") {
                collect_schema_types(graph, out);
            }
            match map.get("@type") {
                Some(Value::String(s)) => out.push(s.clone()),
                Some(Value::Array(types)) => {
                    for t in types {
                        if let Value::String(s) = t {
                            out.push(s.clone());
                        }
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

/// Below this estimated re-minification saving, a page is considered already minified.
const MINIFIED_SAVINGS_THRESHOLD_PCT: f64 = 10.0;

fn strip_html_comments(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        if s[i..].starts_with("<!--") {
            match s[i..].find("-->") {
                Some(end) => {
                    i += end + 3;
                    continue;
                }
                None => break,
            }
        }
        let ch = s[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_was_space = false;
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !last_was_space {
                out.push(' ');
            }
            last_was_space = true;
        } else {
            out.push(ch);
            last_was_space = false;
        }
    }
    out.trim().to_string()
}

/// Estimates how much smaller `body` could get from stripping HTML comments and
/// collapsing whitespace runs. A high savings percentage means the page was served
/// unminified; a low one means it was already minified (or was already tiny/dense).
fn estimate_minify_savings_pct(body: &str) -> f64 {
    let original_len = body.len();
    if original_len == 0 {
        return 0.0;
    }
    let minified = collapse_whitespace(&strip_html_comments(body));
    let minified_len = minified.len();
    if minified_len >= original_len {
        return 0.0;
    }
    (1.0 - (minified_len as f64 / original_len as f64)) * 100.0
}

fn resolve_url(base: &Url, href: &str) -> Option<Url> {
    let href = href.trim();
    if href.is_empty() || href.starts_with('#') {
        return None;
    }
    let lower = href.to_ascii_lowercase();
    if lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || lower.starts_with("javascript:")
        || lower.starts_with("data:")
    {
        return None;
    }
    base.join(href).ok().map(|mut u| {
        u.set_fragment(None);
        u
    })
}

fn is_same_site(base: &Url, other: &Url) -> bool {
    base.host_str() == other.host_str()
}

fn has_rel_value(rel_attr: Option<&str>, value: &str) -> bool {
    rel_attr
        .map(|rel| {
            rel.split_ascii_whitespace()
                .any(|v| v.eq_ignore_ascii_case(value))
        })
        .unwrap_or(false)
}

/// A stable hash of normalized visible text, used to spot duplicate/near-duplicate
/// content across crawled pages. Empty pages hash to an empty string so they never
/// spuriously "match" each other.
fn hash_content(text: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    if text.trim().is_empty() {
        return String::new();
    }
    let normalized = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase();
    let mut hasher = DefaultHasher::new();
    normalized.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn parse_page(body: &str, base: &Url) -> ParsedPage {
    let mut html = Html::parse_document(body);

    // Extract JSON-LD structured data before stripping <script> tags below.
    let mut structured_data_types = Vec::new();
    let mut structured_data_errors = Vec::new();
    for script in html.select(&LD_JSON_SEL) {
        let raw = script.text().collect::<String>();
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        match serde_json::from_str::<Value>(trimmed) {
            Ok(value) => collect_schema_types(&value, &mut structured_data_types),
            Err(e) => structured_data_errors.push(format!("Invalid JSON-LD: {e}")),
        }
    }

    // Strip script/style/noscript/template subtrees so word-count and text
    // extraction only reflect visible content, not embedded code or CSS.
    let remove_ids: Vec<_> = html.select(&REMOVE_SEL).map(|e| e.id()).collect();
    for id in remove_ids {
        if let Some(mut node) = html.tree.get_mut(id) {
            node.detach();
        }
    }

    let title = html
        .select(&TITLE_SEL)
        .next()
        .map(|e| e.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty());

    let mut meta_description = None;
    let mut meta_robots = None;
    let mut viewport = None;
    let mut has_open_graph = false;
    let mut has_twitter_card = false;
    for meta in html.select(&META_SEL) {
        let name = meta.value().attr("name").unwrap_or("").to_ascii_lowercase();
        let property = meta
            .value()
            .attr("property")
            .unwrap_or("")
            .to_ascii_lowercase();
        if name == "description" {
            meta_description = meta
                .value()
                .attr("content")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
        } else if name == "robots" {
            meta_robots = meta
                .value()
                .attr("content")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
        } else if name == "viewport" {
            viewport = meta
                .value()
                .attr("content")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
        } else if name.starts_with("twitter:") {
            has_twitter_card = true;
        }
        if property.starts_with("og:") {
            has_open_graph = true;
        }
    }

    let h1s: Vec<String> = html
        .select(&H1_SEL)
        .map(|e| e.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let h1_count = h1s.len();
    let h1 = h1s.into_iter().next();

    let canonical_links: Vec<_> = html.select(&CANONICAL_SEL).collect();
    let canonical_count = canonical_links.len();
    let canonical = canonical_links
        .first()
        .and_then(|e| e.value().attr("href"))
        .and_then(|href| resolve_url(base, href))
        .map(|u| u.to_string());

    let lang = html
        .select(&HTML_TAG_SEL)
        .next()
        .and_then(|e| e.value().attr("lang"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let hreflang_values: Vec<String> = html
        .select(&HREFLANG_SEL)
        .filter_map(|e| e.value().attr("hreflang"))
        .map(|s| s.to_string())
        .collect();

    let body_text = html
        .select(&BODY_SEL)
        .next()
        .map(|b| b.text().collect::<Vec<_>>().join(" "))
        .unwrap_or_default();
    let word_count = body_text.split_whitespace().count();
    let content_hash = hash_content(&body_text);

    let mut internal_links = Vec::new();
    let mut external_links = Vec::new();
    let mut internal_nofollow_count = 0;
    for a in html.select(&A_SEL) {
        if let Some(href) = a.value().attr("href") {
            if let Some(joined) = resolve_url(base, href) {
                if is_same_site(base, &joined) {
                    if has_rel_value(a.value().attr("rel"), "nofollow") {
                        internal_nofollow_count += 1;
                    }
                    internal_links.push(joined);
                } else {
                    external_links.push(joined);
                }
            }
        }
    }

    let mut images = Vec::new();
    // An explicit alt="" (decorative image) is intentional per accessibility best
    // practice; only a wholly absent alt attribute counts as "missing".
    let mut missing_alt_count = 0;
    for img in html.select(&IMG_SEL) {
        if let Some(src) = img.value().attr("src") {
            if let Some(joined) = resolve_url(base, src) {
                let alt_attr = img.value().attr("alt");
                if alt_attr.is_none() {
                    missing_alt_count += 1;
                }
                let alt = alt_attr.map(|s| s.to_string()).filter(|s| !s.is_empty());
                images.push((joined, alt));
            }
        }
    }

    // A link/image using plain http:// from a page served over https is a mixed
    // content / insecure-resource concern worth flagging.
    let insecure_link_count = if base.scheme() == "https" {
        internal_links
            .iter()
            .chain(external_links.iter())
            .chain(images.iter().map(|(u, _)| u))
            .filter(|u| u.scheme() == "http")
            .count()
    } else {
        0
    };

    let html_size_bytes = body.len();
    let minify_savings_pct = estimate_minify_savings_pct(body);
    let is_minified = minify_savings_pct < MINIFIED_SAVINGS_THRESHOLD_PCT;
    let text_ratio_pct = if html_size_bytes > 0 {
        (body_text.len() as f64 / html_size_bytes as f64) * 100.0
    } else {
        0.0
    };

    ParsedPage {
        title,
        meta_description,
        meta_robots,
        h1,
        h1_count,
        word_count,
        canonical,
        canonical_count,
        internal_links,
        external_links,
        images,
        html_size_bytes,
        minify_savings_pct,
        is_minified,
        insecure_link_count,
        missing_alt_count,
        lang,
        hreflang_values,
        internal_nofollow_count,
        text_ratio_pct,
        content_hash,
        viewport,
        has_open_graph,
        has_twitter_card,
        structured_data_types,
        structured_data_errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Url {
        Url::parse("https://example.com/dir/page").unwrap()
    }

    fn parse(html: &str) -> ParsedPage {
        parse_page(html, &base())
    }

    fn strings(urls: &[Url]) -> Vec<String> {
        urls.iter().map(|u| u.to_string()).collect()
    }

    #[test]
    fn title_is_trimmed_and_empty_title_is_none() {
        assert_eq!(
            parse("<title>  Hello  </title>").title.as_deref(),
            Some("Hello")
        );
        assert_eq!(parse("<title>   </title>").title, None);
        assert_eq!(parse("<p>no title</p>").title, None);
    }

    #[test]
    fn meta_tags_are_matched_case_insensitively() {
        let page = parse(
            r#"<head>
            <meta name="Description" content=" A description ">
            <meta name="ROBOTS" content="noindex">
            <meta name="viewport" content="width=device-width">
            <meta name="keywords" content="ignored">
            </head>"#,
        );
        assert_eq!(page.meta_description.as_deref(), Some("A description"));
        assert_eq!(page.meta_robots.as_deref(), Some("noindex"));
        assert_eq!(page.viewport.as_deref(), Some("width=device-width"));
    }

    #[test]
    fn empty_meta_content_is_none() {
        let page = parse(r#"<meta name="description" content="  ">"#);
        assert_eq!(page.meta_description, None);
    }

    #[test]
    fn detects_open_graph_and_twitter_cards() {
        let page = parse(
            r#"<meta property="og:title" content="x"><meta name="twitter:card" content="summary">"#,
        );
        assert!(page.has_open_graph);
        assert!(page.has_twitter_card);
        let bare = parse("<p>nothing</p>");
        assert!(!bare.has_open_graph);
        assert!(!bare.has_twitter_card);
    }

    #[test]
    fn h1_count_ignores_empty_headings() {
        let page = parse("<h1> First </h1><h1>  </h1><h1>Second</h1>");
        assert_eq!(page.h1_count, 2);
        assert_eq!(page.h1.as_deref(), Some("First"));
    }

    #[test]
    fn canonical_is_resolved_and_counted() {
        let page =
            parse(r#"<link rel="canonical" href="../other#frag"><link rel="canonical" href="/x">"#);
        assert_eq!(page.canonical.as_deref(), Some("https://example.com/other"));
        assert_eq!(page.canonical_count, 2);
        assert_eq!(parse("<p></p>").canonical_count, 0);
    }

    #[test]
    fn reads_lang_and_hreflang() {
        let page = parse(
            r#"<html lang="en-GB"><head>
            <link rel="alternate" hreflang="en" href="/en">
            <link rel="alternate" hreflang="x-default" href="/">
            <link rel="alternate" href="/feed.xml">
            </head></html>"#,
        );
        assert_eq!(page.lang.as_deref(), Some("en-GB"));
        assert_eq!(page.hreflang_values, vec!["en", "x-default"]);
        assert_eq!(parse(r#"<html lang=" "></html>"#).lang, None);
    }

    #[test]
    fn word_count_excludes_non_visible_content() {
        let page = parse(
            r#"<body>one two <script>var a = 1;</script><style>p { x: y }</style>
            <noscript>hidden words</noscript><template>more hidden</template> three</body>"#,
        );
        assert_eq!(page.word_count, 3);
    }

    #[test]
    fn link_resolution_skips_non_navigable_hrefs_and_strips_fragments() {
        let page = parse(
            r##"<a href="#top">a</a><a href="mailto:x@y.z">b</a><a href="tel:123">c</a>
            <a href="JavaScript:void(0)">d</a><a href="data:text/plain,hi">e</a><a href="  ">f</a>
            <a href="sibling#section">g</a><a href="/root">h</a>"##,
        );
        assert_eq!(
            strings(&page.internal_links),
            vec![
                "https://example.com/dir/sibling",
                "https://example.com/root"
            ]
        );
        assert!(page.external_links.is_empty());
    }

    #[test]
    fn splits_internal_and_external_links_by_host() {
        let page = parse(
            r#"<a href="https://example.com/a">a</a><a href="https://other.com/b">b</a>
            <a href="https://sub.example.com/c">c</a>"#,
        );
        assert_eq!(strings(&page.internal_links), vec!["https://example.com/a"]);
        assert_eq!(
            strings(&page.external_links),
            vec!["https://other.com/b", "https://sub.example.com/c"]
        );
    }

    #[test]
    fn counts_internal_nofollow_links_only() {
        let page = parse(
            r#"<a href="/a" rel="noopener NoFollow">a</a><a href="/b" rel="nofollower">b</a>
            <a href="https://other.com/" rel="nofollow">c</a><a href="/d">d</a>"#,
        );
        assert_eq!(page.internal_nofollow_count, 1);
    }

    #[test]
    fn empty_alt_is_decorative_and_not_missing() {
        let page = parse(
            r#"<img src="/a.png" alt="A"><img src="/b.png" alt=""><img src="/c.png"><img alt="no src">"#,
        );
        assert_eq!(page.images.len(), 3);
        assert_eq!(page.missing_alt_count, 1);
        assert_eq!(page.images[0].1.as_deref(), Some("A"));
        assert_eq!(page.images[1].1, None);
    }

    #[test]
    fn insecure_links_are_only_counted_on_https_pages() {
        let html = r#"<a href="http://example.com/a">a</a><a href="http://other.com/">b</a>
            <img src="http://example.com/i.png" alt=""><a href="https://example.com/ok">c</a>"#;
        assert_eq!(parse(html).insecure_link_count, 3);
        let http_base = Url::parse("http://example.com/").unwrap();
        assert_eq!(parse_page(html, &http_base).insecure_link_count, 0);
    }

    #[test]
    fn collects_json_ld_types_from_graphs_arrays_and_type_lists() {
        let page = parse(
            r#"<script type="application/ld+json">{"@graph": [{"@type": "Organization"}, {"@type": ["WebPage", "FAQPage"]}]}</script>
            <script type="application/ld+json">[{"@type": "Product"}, {"@type": "Offer"}]</script>
            <script type="application/ld+json">   </script>"#,
        );
        assert_eq!(
            page.structured_data_types,
            vec!["Organization", "WebPage", "FAQPage", "Product", "Offer"]
        );
        assert!(page.structured_data_errors.is_empty());
    }

    #[test]
    fn invalid_json_ld_is_reported_as_an_error() {
        let page = parse(r#"<script type="application/ld+json">{"@type": </script>"#);
        assert!(page.structured_data_types.is_empty());
        assert_eq!(page.structured_data_errors.len(), 1);
        assert!(page.structured_data_errors[0].starts_with("Invalid JSON-LD"));
    }

    #[test]
    fn content_hash_ignores_whitespace_and_case() {
        let a = parse("<body><p>Hello   World</p></body>");
        let b = parse("<body>\n<div>hello world</div>\n</body>");
        assert!(!a.content_hash.is_empty());
        assert_eq!(a.content_hash, b.content_hash);
        assert_ne!(a.content_hash, parse("<body>Goodbye</body>").content_hash);
        assert_eq!(parse("<body>   </body>").content_hash, "");
    }

    #[test]
    fn whitespace_and_comment_heavy_page_is_not_minified() {
        let padding = " ".repeat(400);
        let html = format!(
            "<html>\n<!-- a long comment block -->{padding}<body>\n\n<p>text</p>{padding}</body></html>"
        );
        let page = parse(&html);
        assert!(page.minify_savings_pct > MINIFIED_SAVINGS_THRESHOLD_PCT);
        assert!(!page.is_minified);
    }

    #[test]
    fn dense_page_is_minified() {
        let html = "<html><head><title>t</title></head><body><p>dense</p></body></html>";
        let page = parse(html);
        assert!(page.is_minified);
        assert_eq!(page.html_size_bytes, html.len());
    }

    #[test]
    fn minify_helpers_handle_edge_cases() {
        assert_eq!(estimate_minify_savings_pct(""), 0.0);
        assert_eq!(strip_html_comments("a<!-- b -->c<!-- unterminated"), "ac");
        assert_eq!(collapse_whitespace("  a \n\t b  "), "a b");
    }
}
