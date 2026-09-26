use crate::crawler::custom::Extraction;
use crate::crawler::types::{HreflangLink, LinkRef, MAX_HREFLANG_LINKS, MAX_OUTLINKS_PER_PAGE};
use scraper::{ElementRef, Html, Selector};
use serde_json::Value;
use std::collections::BTreeMap;
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
static H2_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("h2").unwrap());
static HEADING_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse("h1, h2, h3, h4, h5, h6").unwrap());
static CANONICAL_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse(r#"link[rel="canonical"]"#).unwrap());
static HTML_TAG_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("html").unwrap());
static HREFLANG_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse(r#"link[rel="alternate"][hreflang]"#).unwrap());
static BODY_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("body").unwrap());
static A_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("a[href]").unwrap());
static IMG_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("img[src]").unwrap());
static ANY_IMG_SEL: LazyLock<Selector> = LazyLock::new(|| Selector::parse("img").unwrap());
static HEAD_LINK_SEL: LazyLock<Selector> =
    LazyLock::new(|| Selector::parse("head link[href]").unwrap());
/// Subresources a browser loads (and blocks or warns about) when requested over plain
/// HTTP from an HTTPS page. `srcset` and `<img>` are covered by `insecure_link_count`.
static MIXED_CONTENT_SEL: LazyLock<Selector> = LazyLock::new(|| {
    Selector::parse(
        r#"script[src], link[rel~="stylesheet" i][href], iframe[src], video[src], audio[src], source[src]"#,
    )
    .unwrap()
});

/// Namespace of HTML elements; `<title>` inside inline SVG is in the SVG namespace and is
/// an accessible name for the graphic, not a page title.
const HTML_NS: &str = "http://www.w3.org/1999/xhtml";

/// Most H1/H2 texts stored per page, so one pathological page cannot bloat the
/// crawl event or the saved file. Counts (`h1_count`, `h2_count`) stay exact.
pub const MAX_HEADINGS: usize = 20;
/// Most heading levels stored per page for the heading-order check.
pub const MAX_HEADING_LEVELS: usize = 200;
/// Longest anchor text stored per outlink, in characters.
pub const MAX_ANCHOR_CHARS: usize = 200;
/// Pages with fewer body words than this get an empty `content_simhash`: too few
/// shingles for the fingerprint to say anything about similarity.
pub const SIMHASH_MIN_WORDS: usize = 20;
/// Words per shingle fed to the simhash.
const SIMHASH_SHINGLE_WORDS: usize = 3;

pub struct ParsedPage {
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub meta_robots: Option<String>,
    pub h1: Option<String>,
    pub h1_count: usize,
    pub h1_values: Vec<String>,
    pub h2_values: Vec<String>,
    pub h2_count: usize,
    pub heading_levels: Vec<u8>,
    /// Number of HTML `<title>` elements in the head and body.
    pub title_count: usize,
    /// Number of `<meta name="description">` tags, empty ones included.
    pub meta_description_count: usize,
    /// Trimmed `content` of the first `<meta http-equiv="refresh">`.
    pub meta_refresh: Option<String>,
    /// First `<link rel="next">` in the head, resolved against the page URL.
    pub pagination_next: Option<Url>,
    /// First `<link rel="prev">` in the head, resolved against the page URL.
    pub pagination_prev: Option<Url>,
    pub word_count: usize,
    pub canonical: Option<String>,
    pub canonical_count: usize,
    pub internal_links: Vec<Url>,
    /// Internal links with anchor text and rel flags, in document order, capped
    /// at `MAX_OUTLINKS_PER_PAGE`.
    pub internal_outlinks: Vec<LinkRef>,
    pub external_links: Vec<Url>,
    pub images: Vec<(Url, Option<String>)>,
    pub html_size_bytes: usize,
    pub minify_savings_pct: f64,
    pub is_minified: bool,
    pub insecure_link_count: usize,
    /// On an HTTPS page, the number of scripts, stylesheets, iframes and media
    /// sources that resolve to plain `http:`. Always 0 on a non-HTTPS page.
    pub mixed_content_count: usize,
    pub missing_alt_count: usize,
    /// `<img src>` elements lacking a `width` or `height` attribute (either one absent).
    /// CSS sizing is not considered.
    pub images_missing_dimensions: usize,
    pub lang: Option<String>,
    pub hreflang_values: Vec<String>,
    /// Hreflang annotations with resolvable hrefs, capped at `MAX_HREFLANG_LINKS`.
    pub hreflang_links: Vec<HreflangLink>,
    pub internal_nofollow_count: usize,
    pub text_ratio_pct: f64,
    pub content_hash: String,
    /// 64-bit simhash of the body text as 16 lowercase hex chars; empty for pages
    /// under `SIMHASH_MIN_WORDS` words. See `content_simhash`.
    pub content_simhash: String,
    /// Visible body text (scripts, styles, noscript and template stripped), the text
    /// `word_count` and the content hashes are computed from. Custom search rules
    /// with the text scope run over it so it is not rebuilt.
    pub body_text: String,
    pub viewport: Option<String>,
    pub has_open_graph: bool,
    pub has_twitter_card: bool,
    pub structured_data_types: Vec<String>,
    pub structured_data_errors: Vec<String>,
    /// Values of the crawl's custom extraction rules, keyed by rule id (see
    /// `Extraction::extract`). Empty when the crawl has no rules.
    pub extracted: BTreeMap<String, Vec<String>>,
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

/// Trimmed, non-empty text of every element matching `selector`, in document order.
fn heading_texts(html: &Html, selector: &Selector) -> Vec<String> {
    html.select(selector)
        .map(|e| e.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Levels (1 to 6) of every heading in document order, empty ones included, capped
/// at `MAX_HEADING_LEVELS`. One combined selector keeps the document order.
fn heading_levels(html: &Html) -> Vec<u8> {
    html.select(&HEADING_SEL)
        .filter_map(|e| e.value().name().strip_prefix('h')?.parse::<u8>().ok())
        .take(MAX_HEADING_LEVELS)
        .collect()
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

/// Builds the outlink record for an internal `<a>`: its whitespace-collapsed
/// text, or the alt text of a wrapped image when the link has no text.
fn link_ref(a: ElementRef, target: &Url) -> LinkRef {
    let text = collapse_whitespace(&a.text().collect::<String>());
    let (anchor, is_image_link) = if text.is_empty() {
        match a.select(&ANY_IMG_SEL).next() {
            Some(img) => (
                collapse_whitespace(img.value().attr("alt").unwrap_or("")),
                true,
            ),
            None => (text, false),
        }
    } else {
        (text, false)
    };
    LinkRef {
        url: target.to_string(),
        anchor: anchor.chars().take(MAX_ANCHOR_CHARS).collect(),
        nofollow: has_rel_value(a.value().attr("rel"), "nofollow"),
        is_image_link,
    }
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

/// 64-bit FNV-1a. Implemented inline because `DefaultHasher` output is not guaranteed
/// to stay the same between Rust releases, and simhashes are persisted in saved crawls.
fn fnv1a64(bytes: &[u8]) -> u64 {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    bytes.iter().fold(OFFSET_BASIS, |hash, &b| {
        (hash ^ u64::from(b)).wrapping_mul(PRIME)
    })
}

/// Charikar simhash over lowercase word 3-shingles of `text`, as 16 hex chars (a string
/// because JSON numbers lose precision past 2^53). Words are lowercased and stripped of
/// leading/trailing punctuation. Empty when the text has fewer than `SIMHASH_MIN_WORDS`
/// words. Near-identical texts get fingerprints a small Hamming distance apart.
pub fn content_simhash(text: &str) -> String {
    let words: Vec<String> = text
        .split_whitespace()
        .map(|w| {
            w.trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase()
        })
        .filter(|w| !w.is_empty())
        .collect();
    if words.len() < SIMHASH_MIN_WORDS {
        return String::new();
    }
    let mut weights = [0i32; 64];
    for shingle in words.windows(SIMHASH_SHINGLE_WORDS) {
        let hash = fnv1a64(shingle.join(" ").as_bytes());
        for (bit, weight) in weights.iter_mut().enumerate() {
            if hash >> bit & 1 == 1 {
                *weight += 1;
            } else {
                *weight -= 1;
            }
        }
    }
    let fingerprint = weights
        .iter()
        .enumerate()
        .filter(|(_, &w)| w > 0)
        .fold(0u64, |acc, (bit, _)| acc | 1 << bit);
    format!("{fingerprint:016x}")
}

/// Counts subresources (see `MIXED_CONTENT_SEL`) that resolve to `http:` when the page
/// itself was served over `https:`.
fn count_mixed_content(document: &Html, base: &Url) -> usize {
    if base.scheme() != "https" {
        return 0;
    }
    document
        .select(&MIXED_CONTENT_SEL)
        .filter_map(|el| {
            let attr = if el.value().name() == "link" {
                "href"
            } else {
                "src"
            };
            el.value().attr(attr)
        })
        .filter_map(|src| resolve_url(base, src))
        .filter(|u| u.scheme() == "http")
        .count()
}

/// `parse_page_with` without custom extraction rules (the crawl always passes its rules).
#[cfg(test)]
pub fn parse_page(body: &str, base: &Url) -> ParsedPage {
    parse_page_with(body, base, &Extraction::default())
}

/// Parses `body` once and extracts every signal from it, custom extraction rules included.
pub fn parse_page_with(body: &str, base: &Url, extraction: &Extraction) -> ParsedPage {
    let mut html = Html::parse_document(body);

    // Custom extraction runs on the full document, before <script>, <style>, <noscript>
    // and <template> are stripped below, so a rule can extract JSON-LD or inline code.
    let extracted = extraction.extract(&html);

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

    // Counted before <script> subtrees are stripped below.
    let mixed_content_count = count_mixed_content(&html, base);

    // Strip script/style/noscript/template subtrees so word-count and text
    // extraction only reflect visible content, not embedded code or CSS.
    let remove_ids: Vec<_> = html.select(&REMOVE_SEL).map(|e| e.id()).collect();
    for id in remove_ids {
        if let Some(mut node) = html.tree.get_mut(id) {
            node.detach();
        }
    }

    let html_titles: Vec<_> = html
        .select(&TITLE_SEL)
        .filter(|e| &*e.value().name.ns == HTML_NS)
        .collect();
    let title_count = html_titles.len();
    let title = html_titles
        .first()
        .map(|e| e.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty());

    let mut meta_description = None;
    let mut meta_description_count = 0;
    let mut meta_refresh = None;
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
        if meta_refresh.is_none()
            && meta
                .value()
                .attr("http-equiv")
                .is_some_and(|v| v.trim().eq_ignore_ascii_case("refresh"))
        {
            meta_refresh = meta
                .value()
                .attr("content")
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
        }
        if name == "description" {
            meta_description_count += 1;
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

    let mut h1_values = heading_texts(&html, &H1_SEL);
    let h1_count = h1_values.len();
    let h1 = h1_values.first().cloned();
    h1_values.truncate(MAX_HEADINGS);
    let mut h2_values = heading_texts(&html, &H2_SEL);
    let h2_count = h2_values.len();
    h2_values.truncate(MAX_HEADINGS);
    let heading_levels = heading_levels(&html);

    let canonical_links: Vec<_> = html.select(&CANONICAL_SEL).collect();
    let canonical_count = canonical_links.len();
    let canonical = canonical_links
        .first()
        .and_then(|e| e.value().attr("href"))
        .and_then(|href| resolve_url(base, href))
        .map(|u| u.to_string());

    let mut pagination_next = None;
    let mut pagination_prev = None;
    for link in html.select(&HEAD_LINK_SEL) {
        let rel = link.value().attr("rel");
        let slot = if has_rel_value(rel, "next") {
            &mut pagination_next
        } else if has_rel_value(rel, "prev") {
            &mut pagination_prev
        } else {
            continue;
        };
        if slot.is_none() {
            *slot = link
                .value()
                .attr("href")
                .and_then(|href| resolve_url(base, href));
        }
    }

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
    let hreflang_links: Vec<HreflangLink> = html
        .select(&HREFLANG_SEL)
        .filter_map(|e| {
            let lang = e.value().attr("hreflang")?.trim();
            let href = resolve_url(base, e.value().attr("href")?)?;
            (!lang.is_empty()).then(|| HreflangLink {
                lang: lang.to_string(),
                href: href.to_string(),
            })
        })
        .take(MAX_HREFLANG_LINKS)
        .collect();

    let body_text = html
        .select(&BODY_SEL)
        .next()
        .map(|b| b.text().collect::<Vec<_>>().join(" "))
        .unwrap_or_default();
    let word_count = body_text.split_whitespace().count();
    let content_hash = hash_content(&body_text);
    let content_simhash = content_simhash(&body_text);

    let mut internal_links = Vec::new();
    let mut internal_outlinks = Vec::new();
    let mut external_links = Vec::new();
    let mut internal_nofollow_count = 0;
    for a in html.select(&A_SEL) {
        if let Some(href) = a.value().attr("href") {
            if let Some(joined) = resolve_url(base, href) {
                if is_same_site(base, &joined) {
                    if has_rel_value(a.value().attr("rel"), "nofollow") {
                        internal_nofollow_count += 1;
                    }
                    if internal_outlinks.len() < MAX_OUTLINKS_PER_PAGE {
                        internal_outlinks.push(link_ref(a, &joined));
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
    let mut images_missing_dimensions = 0;
    for img in html.select(&IMG_SEL) {
        if let Some(src) = img.value().attr("src") {
            if let Some(joined) = resolve_url(base, src) {
                let alt_attr = img.value().attr("alt");
                if alt_attr.is_none() {
                    missing_alt_count += 1;
                }
                if img.value().attr("width").is_none() || img.value().attr("height").is_none() {
                    images_missing_dimensions += 1;
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
        h1_values,
        h2_values,
        h2_count,
        heading_levels,
        title_count,
        meta_description_count,
        meta_refresh,
        pagination_next,
        pagination_prev,
        word_count,
        canonical,
        canonical_count,
        internal_links,
        internal_outlinks,
        external_links,
        images,
        html_size_bytes,
        minify_savings_pct,
        is_minified,
        insecure_link_count,
        mixed_content_count,
        missing_alt_count,
        images_missing_dimensions,
        lang,
        hreflang_values,
        hreflang_links,
        internal_nofollow_count,
        text_ratio_pct,
        content_hash,
        content_simhash,
        body_text,
        viewport,
        has_open_graph,
        has_twitter_card,
        structured_data_types,
        structured_data_errors,
        extracted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crawler::custom::{MAX_EXTRACTED_CHARS, MAX_EXTRACTED_VALUES};
    use crate::crawler::types::{ExtractionMode, ExtractionRule};

    fn base() -> Url {
        Url::parse("https://example.com/dir/page").unwrap()
    }

    fn parse(html: &str) -> ParsedPage {
        parse_page(html, &base())
    }

    fn extraction_rule(id: &str, selector: &str, mode: ExtractionMode) -> ExtractionRule {
        ExtractionRule {
            id: id.to_string(),
            name: String::new(),
            selector: selector.to_string(),
            mode,
            attr: None,
        }
    }

    #[test]
    fn extracts_text_attr_and_inner_html() {
        let html = r#"<html><head>
            <meta property="og:image" content=" https://example.com/og.png ">
            <script type="application/ld+json">{"@type": "Product"}</script>
            <style>.price { color: red }</style></head>
            <body>
              <p class="price">
                 $19.99
                 <small>incl.   tax</small></p>
              <p class="price">   </p>
              <p class="price">$5</p>
              <div id="box"> <b>bold</b> text </div>
              <a href="/a">no rel</a>
            </body></html>"#;
        let mut og = extraction_rule("og", r#"meta[property="og:image"]"#, ExtractionMode::Attr);
        og.attr = Some("content".to_string());
        let mut rel = extraction_rule("rel", "a", ExtractionMode::Attr);
        rel.attr = Some("rel".to_string());
        let extraction = Extraction::new(&[
            extraction_rule("price", ".price", ExtractionMode::Text),
            og,
            extraction_rule("box", "#box", ExtractionMode::InnerHtml),
            extraction_rule(
                "ld",
                r#"script[type="application/ld+json"]"#,
                ExtractionMode::Text,
            ),
            rel,
            extraction_rule("none", ".missing", ExtractionMode::Text),
        ])
        .unwrap();
        let parsed = parse_page_with(html, &base(), &extraction);
        let ex = &parsed.extracted;
        // Whitespace collapsed; the blank element is skipped.
        assert_eq!(ex["price"], vec!["$19.99 incl. tax", "$5"]);
        assert_eq!(ex["og"], vec!["https://example.com/og.png"]);
        assert_eq!(ex["box"], vec!["<b>bold</b> text"]);
        // Extraction runs before scripts are stripped.
        assert_eq!(ex["ld"], vec![r#"{"@type": "Product"}"#]);
        // An element without the attribute gives no value; every rule still has an entry.
        assert!(ex["rel"].is_empty());
        assert!(ex["none"].is_empty());
        // The rest of parsing still strips scripts from the visible text.
        assert!(!parsed.body_text.contains("Product"));
        assert!(parse(html).extracted.is_empty());
    }

    #[test]
    fn extraction_values_are_capped() {
        let long_word = "\u{e9}".repeat(MAX_EXTRACTED_CHARS + 50);
        let items: String = (0..MAX_EXTRACTED_VALUES + 5)
            .map(|i| format!("<li>item {i}</li>"))
            .collect();
        let html = format!("<body><ul>{items}</ul><p>{long_word}</p></body>");
        let extraction = Extraction::new(&[
            extraction_rule("li", "li", ExtractionMode::Text),
            extraction_rule("p", "p", ExtractionMode::Text),
        ])
        .unwrap();
        let ex = parse_page_with(&html, &base(), &extraction).extracted;
        assert_eq!(ex["li"].len(), MAX_EXTRACTED_VALUES);
        assert_eq!(ex["li"][0], "item 0");
        assert_eq!(
            ex["li"][MAX_EXTRACTED_VALUES - 1],
            format!("item {}", MAX_EXTRACTED_VALUES - 1)
        );
        assert_eq!(ex["p"].len(), 1);
        assert_eq!(ex["p"][0].chars().count(), MAX_EXTRACTED_CHARS);
        assert!(long_word.starts_with(&ex["p"][0]));
    }

    fn strings(urls: &[Url]) -> Vec<String> {
        urls.iter().map(|u| u.to_string()).collect()
    }

    #[test]
    fn counts_multiple_titles_and_descriptions() {
        let page = parse(
            r#"<html><head><title>First</title><title>Second</title>
            <meta name="description" content="One">
            <meta name="Description" content="Two">
            <meta name="description" content="">
            </head><body><title>In body</title>
            <svg><title>Icon label</title></svg></body></html>"#,
        );
        assert_eq!(page.title_count, 3);
        assert_eq!(page.title.as_deref(), Some("First"));
        assert_eq!(page.meta_description_count, 3);

        let single = parse(
            r#"<head><title>Only</title><meta name="description" content="x"></head>
            <body><svg><title>Icon</title></svg></body>"#,
        );
        assert_eq!(single.title_count, 1);
        assert_eq!(single.meta_description_count, 1);

        let none = parse("<p>nothing</p>");
        assert_eq!(none.title_count, 0);
        assert_eq!(none.meta_description_count, 0);
    }

    #[test]
    fn extracts_meta_refresh_case_insensitively() {
        let page = parse(r#"<head><meta HTTP-EQUIV="Refresh" content=" 5; url=/next "></head>"#);
        assert_eq!(page.meta_refresh.as_deref(), Some("5; url=/next"));
        let first_wins = parse(
            r#"<head><meta http-equiv="refresh" content="0"><meta http-equiv="REFRESH" content="9"></head>"#,
        );
        assert_eq!(first_wins.meta_refresh.as_deref(), Some("0"));
        assert_eq!(
            parse(r#"<meta http-equiv="content-type" content="text/html">"#).meta_refresh,
            None
        );
        assert_eq!(
            parse(r#"<meta http-equiv="refresh" content="  ">"#).meta_refresh,
            None
        );
    }

    #[test]
    fn resolves_pagination_links() {
        let page = parse(
            r#"<html><head>
            <link rel="prev" href="/list?page=1#top">
            <link rel="NEXT" href="page3">
            <link rel="next" href="/ignored-second">
            </head><body><a rel="next" href="/anchor-next">n</a></body></html>"#,
        );
        assert_eq!(
            page.pagination_next.map(|u| u.to_string()).as_deref(),
            Some("https://example.com/dir/page3")
        );
        assert_eq!(
            page.pagination_prev.map(|u| u.to_string()).as_deref(),
            Some("https://example.com/list?page=1")
        );

        let body_only = parse(r#"<body><p>x</p><link rel="next" href="/late"></body>"#);
        assert!(body_only.pagination_next.is_none());
        assert!(body_only.pagination_prev.is_none());
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
    fn collects_heading_levels_in_document_order() {
        let page = parse(
            "<h1>Top</h1><h3>Skip</h3><h2> </h2><div><h2>Real</h2><h6>Deep</h6></div><h1>Again</h1>",
        );
        // Empty headings still count for order, but not as H1/H2 values.
        assert_eq!(page.heading_levels, vec![1, 3, 2, 2, 6, 1]);
        assert_eq!(page.h1_values, vec!["Top", "Again"]);
        assert_eq!(page.h2_values, vec!["Real"]);
        assert_eq!(page.h2_count, 1);
        assert!(parse("<p>none</p>").heading_levels.is_empty());
    }

    #[test]
    fn caps_heading_lists() {
        let html = "<h1>a</h1><h2>b</h2>".repeat(MAX_HEADING_LEVELS);
        let page = parse(&html);
        assert_eq!(page.h1_count, MAX_HEADING_LEVELS);
        assert_eq!(page.h2_count, MAX_HEADING_LEVELS);
        assert_eq!(page.h1_values.len(), MAX_HEADINGS);
        assert_eq!(page.h2_values.len(), MAX_HEADINGS);
        assert_eq!(page.heading_levels.len(), MAX_HEADING_LEVELS);
        assert_eq!(page.h1.as_deref(), Some("a"));
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
    fn collects_hreflang_pairs() {
        let page = parse(
            r#"<html><head>
            <link rel="alternate" hreflang="en" href="/en#top">
            <link rel="alternate" hreflang="fr-FR" href="https://other.example/fr">
            <link rel="alternate" hreflang="x-default" href="/">
            <link rel="alternate" hreflang="de">
            <link rel="alternate" hreflang=" " href="/blank">
            </head></html>"#,
        );
        let pairs: Vec<(&str, &str)> = page
            .hreflang_links
            .iter()
            .map(|l| (l.lang.as_str(), l.href.as_str()))
            .collect();
        assert_eq!(
            pairs,
            vec![
                ("en", "https://example.com/en"),
                ("fr-FR", "https://other.example/fr"),
                ("x-default", "https://example.com/"),
            ]
        );
        // hreflang_values keeps every declared code, as before.
        assert_eq!(page.hreflang_values.len(), 5);
    }

    #[test]
    fn hreflang_links_are_capped() {
        let html =
            r#"<link rel="alternate" hreflang="en" href="/x">"#.repeat(MAX_HREFLANG_LINKS + 5);
        assert_eq!(parse(&html).hreflang_links.len(), MAX_HREFLANG_LINKS);
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
    fn outlink_anchor_is_collapsed_text() {
        let long = "x".repeat(MAX_ANCHOR_CHARS + 50);
        let page = parse(&format!(
            r#"<a href="/a">  Read
            the <b>guide</b>  </a><a href="/a">Other anchor</a><a href="/b">{long}</a>
            <a href="https://other.com/">external</a>"#
        ));
        let anchors: Vec<_> = page
            .internal_outlinks
            .iter()
            .map(|l| l.anchor.as_str())
            .collect();
        assert_eq!(anchors[..2], ["Read the guide", "Other anchor"]);
        assert_eq!(anchors[2].chars().count(), MAX_ANCHOR_CHARS);
        // Duplicates are kept, external links are not outlinks.
        assert_eq!(page.internal_outlinks.len(), 3);
        assert_eq!(page.internal_outlinks[0].url, "https://example.com/a");
        assert_eq!(page.internal_outlinks[1].url, "https://example.com/a");
        assert!(!page.internal_outlinks[0].is_image_link);
    }

    #[test]
    fn image_link_uses_alt_as_anchor() {
        let page = parse(
            r#"<a href="/a"><img src="/i.png" alt=" Company   logo "></a>
            <a href="/b"><img src="/j.png"></a>
            <a href="/c"><img src="/k.png" alt="ignored"> Caption</a>
            <a href="/d"> </a>"#,
        );
        let got: Vec<_> = page
            .internal_outlinks
            .iter()
            .map(|l| (l.anchor.as_str(), l.is_image_link))
            .collect();
        assert_eq!(
            got,
            vec![
                ("Company logo", true),
                ("", true),
                ("Caption", false),
                ("", false)
            ]
        );
    }

    #[test]
    fn nofollow_detected_among_multiple_rel_values() {
        let page = parse(
            r#"<a href="/a" rel="ugc NoFollow sponsored">a</a><a href="/b" rel="nofollower">b</a>
            <a href="/c">c</a>"#,
        );
        let flags: Vec<_> = page.internal_outlinks.iter().map(|l| l.nofollow).collect();
        assert_eq!(flags, vec![true, false, false]);
    }

    #[test]
    fn outlinks_are_capped() {
        let html = r#"<a href="/x">x</a>"#.repeat(MAX_OUTLINKS_PER_PAGE + 5);
        let page = parse(&html);
        assert_eq!(page.internal_outlinks.len(), MAX_OUTLINKS_PER_PAGE);
        assert_eq!(page.internal_links.len(), MAX_OUTLINKS_PER_PAGE + 5);
    }

    #[test]
    fn counts_images_missing_dimensions() {
        let page = parse(
            r#"<img src="/a.png" width="10" height="10">
            <img src="/b.png" width="10">
            <img src="/c.png" height="10">
            <img src="/d.png">
            <img src="/e.png" style="width:10px;height:10px">
            <img width="1" alt="no src">"#,
        );
        assert_eq!(page.images.len(), 5);
        assert_eq!(page.images_missing_dimensions, 4);
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
    fn counts_http_subresources_on_https_page() {
        let html = r#"<html><head>
            <script src="http://cdn.example.com/a.js"></script>
            <script src="https://cdn.example.com/ok.js"></script>
            <script>inline()</script>
            <link rel="stylesheet" href="http://cdn.example.com/a.css">
            <link rel="preload stylesheet" href="http://cdn.example.com/b.css">
            <link rel="icon" href="http://cdn.example.com/favicon.ico">
            <link rel="stylesheet" href="/relative.css">
            </head><body>
            <iframe src="http://embed.example.com/"></iframe>
            <video src="http://media.example.com/v.mp4"></video>
            <audio><source src="http://media.example.com/a.mp3"></audio>
            <a href="http://example.com/page">not a subresource</a>
            </body></html>"#;
        assert_eq!(parse(html).mixed_content_count, 6);
    }

    #[test]
    fn ignores_mixed_content_on_http_page() {
        let html = r#"<script src="http://cdn.example.com/a.js"></script>
            <link rel="stylesheet" href="http://cdn.example.com/a.css">
            <iframe src="http://embed.example.com/"></iframe>"#;
        let http_base = Url::parse("http://example.com/").unwrap();
        assert_eq!(parse_page(html, &http_base).mixed_content_count, 0);
        assert_eq!(
            parse(r#"<script src="/a.js"></script>"#).mixed_content_count,
            0
        );
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

    /// About 60 words of original prose used by the simhash tests.
    const SIMHASH_TEXT: &str = "Our small bakery opens every morning at six with fresh         sourdough loaves, buttery croissants and seasonal fruit tarts. The ovens are         wood fired and the flour comes from a family mill two valleys away. Regulars         know to arrive early on Saturdays because the cinnamon buns sell out before         nine. We also bake custom cakes for birthdays and weddings when ordered a week         ahead.";

    fn hamming(a: &str, b: &str) -> u32 {
        let a = u64::from_str_radix(a, 16).unwrap();
        let b = u64::from_str_radix(b, 16).unwrap();
        (a ^ b).count_ones()
    }

    #[test]
    fn simhash_is_stable_across_runs() {
        let hash = content_simhash(SIMHASH_TEXT);
        assert_eq!(hash.len(), 16);
        assert_eq!(hash, "fde217e8fa0fab49");
        assert_eq!(fnv1a64(b""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(fnv1a64(b"a"), 0xaf63_dc4c_8601_ec8c);
    }

    #[test]
    fn similar_texts_have_small_hamming_distance() {
        let original = content_simhash(SIMHASH_TEXT);
        // One word changed out of about 60 (three of 58 shingles differ).
        let edited = content_simhash(&SIMHASH_TEXT.replace("nine", "ten"));
        assert_ne!(original, edited);
        let d = hamming(&original, &edited);
        assert!(d <= 3, "distance {d}");
        let unrelated = content_simhash(
            "Winter tyres grip better below seven degrees because their rubber compound              stays soft and the deep sipes bite into slush, while summer tyres harden and              lose traction. Swap them before the first frost and store the spare set              indoors, stacked flat, away from sunlight and electric motors that emit ozone.",
        );
        let far = hamming(&original, &unrelated);
        assert!(far > 10, "distance {far}");
    }

    #[test]
    fn short_pages_have_empty_simhash() {
        let nineteen = "one two three four five six seven eight nine ten eleven twelve             thirteen fourteen fifteen sixteen seventeen eighteen nineteen";
        assert_eq!(content_simhash(nineteen), "");
        assert_eq!(content_simhash(&format!("{nineteen} twenty")).len(), 16);
        assert_eq!(
            parse("<body><p>Too short to fingerprint.</p></body>").content_simhash,
            ""
        );
        // Punctuation-only tokens do not count as words.
        assert_eq!(content_simhash(&format!("{nineteen} --- !!")), "");
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
