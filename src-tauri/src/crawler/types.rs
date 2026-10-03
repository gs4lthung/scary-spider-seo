use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlConfig {
    pub start_url: String,
    #[serde(default = "default_max_pages")]
    pub max_pages: usize,
    #[serde(default = "default_max_depth")]
    pub max_depth: usize,
    #[serde(default = "default_concurrency")]
    pub concurrency: usize,
    #[serde(default = "default_user_agent")]
    pub user_agent: String,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// Minimum delay, in milliseconds, between starting successive page requests —
    /// a politeness throttle independent of `concurrency`. The site's robots.txt
    /// `Crawl-delay`, if present and longer, takes precedence (see `run_crawl`).
    #[serde(default)]
    pub delay_ms: u64,
    #[serde(default = "default_true")]
    pub check_external_links: bool,
    #[serde(default = "default_true")]
    pub check_images: bool,
    #[serde(default)]
    pub respect_robots: bool,
    #[serde(default)]
    pub use_sitemap: bool,
    #[serde(default)]
    pub render_js: bool,
    #[serde(default)]
    pub lookup_hosting: bool,
    #[serde(default)]
    pub run_accessibility_audit: bool,
    #[serde(default)]
    pub run_mobile_usability_audit: bool,
    /// Regular expressions matched against the full URL: when any are given, a
    /// discovered URL must match at least one to be crawled. The start URL is exempt.
    #[serde(default)]
    pub include_patterns: Vec<String>,
    /// Regular expressions matched against the full URL: a discovered URL matching any
    /// of them is not crawled. Wins over `include_patterns`.
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
    /// List mode when non-empty: crawl exactly these URLs (no link following, no sitemap),
    /// each at depth 0. Unparsable or non-http(s) entries are ignored. At most
    /// `MAX_LIST_URLS` entries are accepted by `start_crawl`.
    #[serde(default)]
    pub list_urls: Vec<String>,
    /// Custom search rules (at most `custom::MAX_CUSTOM_SEARCHES`), counted on every
    /// HTML page into `PageResult::custom_search_counts`.
    #[serde(default)]
    pub custom_searches: Vec<CustomSearchRule>,
    /// Custom extraction rules (at most `custom::MAX_EXTRACTIONS`), run on every HTML
    /// page into `PageResult::extracted`.
    #[serde(default)]
    pub extractions: Vec<ExtractionRule>,
    /// With `render_js` on, also GET and parse the raw (pre-JavaScript) HTML of every
    /// page into `PageResult::raw`, so the frontend can flag what JavaScript changed.
    /// Ignored without `render_js`.
    #[serde(default)]
    pub compare_raw_html: bool,
}

/// One custom extraction rule: a CSS selector and what to take from each element it
/// matches.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionRule {
    /// Stable key of the rule's values in `PageResult::extracted`.
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub selector: String,
    #[serde(default)]
    pub mode: ExtractionMode,
    /// Attribute to read in `ExtractionMode::Attr`; ignored by the other modes.
    #[serde(default)]
    pub attr: Option<String>,
}

/// What an extraction rule takes from a matched element.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtractionMode {
    /// The element's text, whitespace collapsed.
    #[default]
    Text,
    /// The value of one attribute (`ExtractionRule::attr`).
    Attr,
    /// The element's inner HTML.
    InnerHtml,
}

/// One custom search rule: a literal text (matched case-insensitively) or a regular
/// expression, searched in the raw HTML or the visible body text.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSearchRule {
    /// Stable key of the rule's count in `PageResult::custom_search_counts`.
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub pattern: String,
    #[serde(default)]
    pub is_regex: bool,
    #[serde(default)]
    pub scope: CustomSearchScope,
}

/// What a custom search rule is matched against.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CustomSearchScope {
    /// The raw response body, markup and scripts included.
    #[default]
    Html,
    /// The visible body text: scripts, styles and tags stripped.
    Text,
}

/// Largest list `start_crawl` accepts in list mode.
pub const MAX_LIST_URLS: usize = 50_000;

impl CrawlConfig {
    /// True when the crawl runs in list mode (`list_urls` is non-empty).
    pub fn is_list_mode(&self) -> bool {
        !self.list_urls.is_empty()
    }
}

fn default_max_pages() -> usize {
    500
}
fn default_max_depth() -> usize {
    10
}
fn default_concurrency() -> usize {
    5
}
fn default_user_agent() -> String {
    "ScarySpiderSEO/0.1 (+https://worldcraftlogistics.com)".to_string()
}
fn default_timeout() -> u64 {
    15
}
fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResourceType {
    Link,
    Image,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageResult {
    pub url: String,
    #[serde(default)]
    pub depth: usize,
    #[serde(default)]
    pub status: Option<u16>,
    #[serde(default)]
    pub status_text: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub title_length: usize,
    #[serde(default)]
    pub meta_description: Option<String>,
    #[serde(default)]
    pub meta_description_length: usize,
    #[serde(default)]
    pub h1: Option<String>,
    #[serde(default)]
    pub h1_count: usize,
    /// Text of each non-empty H1 in document order, capped at `parse::MAX_HEADINGS`.
    #[serde(default)]
    pub h1_values: Vec<String>,
    /// Text of each non-empty H2 in document order, capped at `parse::MAX_HEADINGS`.
    #[serde(default)]
    pub h2_values: Vec<String>,
    /// Number of non-empty H2s (uncapped).
    #[serde(default)]
    pub h2_count: usize,
    /// Level of every heading (1 to 6) in document order, empty ones included,
    /// capped at `parse::MAX_HEADING_LEVELS`.
    #[serde(default)]
    pub heading_levels: Vec<u8>,
    /// Number of HTML `<title>` elements in the head and body.
    #[serde(default)]
    pub title_count: usize,
    /// Number of `<meta name="description">` tags, empty ones included.
    #[serde(default)]
    pub meta_description_count: usize,
    /// Trimmed `content` of the first `<meta http-equiv="refresh">`.
    #[serde(default)]
    pub meta_refresh: Option<String>,
    /// Absolute URL of the first `<link rel="next">` in the head.
    #[serde(default)]
    pub pagination_next: Option<String>,
    /// Absolute URL of the first `<link rel="prev">` in the head.
    #[serde(default)]
    pub pagination_prev: Option<String>,
    #[serde(default)]
    pub word_count: usize,
    #[serde(default)]
    pub canonical: Option<String>,
    #[serde(default)]
    pub meta_robots: Option<String>,
    #[serde(default)]
    pub redirect_url: Option<String>,
    #[serde(default)]
    pub indexability: String,
    #[serde(default)]
    pub response_time_ms: u64,
    #[serde(default)]
    pub internal_link_count: usize,
    #[serde(default)]
    pub external_link_count: usize,
    #[serde(default)]
    pub image_count: usize,
    #[serde(default)]
    pub html_size_bytes: usize,
    #[serde(default)]
    pub minify_savings_pct: f64,
    #[serde(default)]
    pub is_minified: bool,
    /// Added after the initial save-file format shipped — must default so older saved crawls
    /// (which predate this field) still deserialize instead of failing to load.
    #[serde(default)]
    pub rendered: bool,
    #[serde(default)]
    pub hsts: bool,
    /// Raw `Content-Security-Policy` response header, if sent.
    #[serde(default)]
    pub content_security_policy: Option<String>,
    /// Raw `X-Frame-Options` response header, if sent.
    #[serde(default)]
    pub x_frame_options: Option<String>,
    /// Raw `X-Content-Type-Options` response header, if sent.
    #[serde(default)]
    pub x_content_type_options: Option<String>,
    /// Raw `Referrer-Policy` response header, if sent.
    #[serde(default)]
    pub referrer_policy: Option<String>,
    /// True when the four security header fields above were read from a response.
    /// False for crawls saved before they existed (and for fetch errors), so the
    /// frontend does not report every page of an old crawl as missing them.
    #[serde(default)]
    pub security_headers_captured: bool,
    /// Scripts, stylesheets, iframes and media loaded over `http:` from an `https:` page.
    #[serde(default)]
    pub mixed_content_count: usize,
    #[serde(default)]
    pub insecure_link_count: usize,
    #[serde(default)]
    pub missing_alt_count: usize,
    /// `<img src>` elements missing a `width` or `height` attribute. 0 for crawls
    /// saved before this field existed.
    #[serde(default)]
    pub images_missing_dimensions: usize,
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub hreflang_values: Vec<String>,
    /// `<link rel="alternate" hreflang>` annotations with their hrefs resolved to
    /// absolute URLs (fragment stripped), in document order, capped at
    /// `MAX_HREFLANG_LINKS`. Empty for crawls saved before this field existed.
    #[serde(default)]
    pub hreflang_links: Vec<HreflangLink>,
    #[serde(default)]
    pub internal_nofollow_count: usize,
    /// Every internal `<a href>` on the page in document order, duplicates kept,
    /// capped at `MAX_OUTLINKS_PER_PAGE`. `internal_link_count` stays uncapped.
    #[serde(default)]
    pub outlinks: Vec<LinkRef>,
    #[serde(default)]
    pub text_ratio_pct: f64,
    #[serde(default)]
    pub content_hash: String,
    /// 64-bit simhash of the body text as 16 hex chars, for near-duplicate detection.
    /// Empty for short or non-HTML pages and for crawls saved before this field existed.
    #[serde(default)]
    pub content_simhash: String,
    #[serde(default)]
    pub x_robots_tag: Option<String>,
    #[serde(default)]
    pub viewport: Option<String>,
    #[serde(default)]
    pub has_open_graph: bool,
    #[serde(default)]
    pub has_twitter_card: bool,
    #[serde(default)]
    pub canonical_count: usize,
    #[serde(default)]
    pub discovered_via_sitemap: bool,
    #[serde(default)]
    pub redirect_chain: Vec<String>,
    #[serde(default)]
    pub structured_data_types: Vec<String>,
    #[serde(default)]
    pub structured_data_errors: Vec<String>,
    #[serde(default)]
    pub accessibility_violations: Vec<AccessibilityViolation>,
    #[serde(default)]
    pub mobile_usability_violations: Vec<MobileUsabilityViolation>,
    /// Match count of every custom search rule of the crawl, keyed by rule id, for
    /// parsed HTML pages (0 included). Empty for other URLs, crawls without rules and
    /// crawls saved before custom search existed.
    #[serde(default)]
    pub custom_search_counts: BTreeMap<String, u32>,
    /// Values of every custom extraction rule of the crawl, keyed by rule id, for parsed
    /// HTML pages (an empty list when nothing matched). At most
    /// `custom::MAX_EXTRACTED_VALUES` values per rule, each at most
    /// `custom::MAX_EXTRACTED_CHARS` characters. Empty for other URLs, crawls without
    /// rules and crawls saved before custom extraction existed.
    #[serde(default)]
    pub extracted: BTreeMap<String, Vec<String>>,
    /// SEO signals of the raw HTML, before JavaScript ran. Set only for pages that were
    /// rendered by a crawl with `compare_raw_html` on; `None` otherwise, including for
    /// every crawl saved before this field existed.
    #[serde(default)]
    pub raw: Option<RawSignals>,
    #[serde(default)]
    pub error: Option<String>,
}

/// The SEO critical elements of a page's raw (unrendered) HTML, compared by the frontend
/// against the rendered values on the same `PageResult`. Built by `RawSignals::from_parsed`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawSignals {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub meta_description: Option<String>,
    #[serde(default)]
    pub h1: Option<String>,
    #[serde(default)]
    pub canonical: Option<String>,
    #[serde(default)]
    pub meta_robots: Option<String>,
    #[serde(default)]
    pub word_count: usize,
    #[serde(default)]
    pub internal_link_count: usize,
}

/// Most internal outlinks stored per page, so a page with a huge link list cannot
/// bloat the crawl event or the saved file.
pub const MAX_OUTLINKS_PER_PAGE: usize = 1000;

/// One internal link found on a page.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRef {
    /// Absolute target URL, fragment stripped.
    pub url: String,
    /// Whitespace-collapsed link text (at most 200 chars), or the alt text of a
    /// wrapped image when the link has no text.
    #[serde(default)]
    pub anchor: String,
    /// `rel` contains `nofollow` (case-insensitive, among other values).
    #[serde(default)]
    pub nofollow: bool,
    /// The link has no text and wraps an `<img>`.
    #[serde(default)]
    pub is_image_link: bool,
}

/// Most hreflang annotations stored per page.
pub const MAX_HREFLANG_LINKS: usize = 300;

/// One hreflang annotation: the declared language/region code as written and
/// its absolute target URL.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HreflangLink {
    pub lang: String,
    pub href: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilityViolation {
    pub id: String,
    pub impact: Option<String>,
    pub description: String,
    pub help_url: String,
    pub node_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileUsabilityViolation {
    pub id: String,
    pub description: String,
    pub help_url: String,
    pub node_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceResult {
    pub url: String,
    pub resource_type: ResourceType,
    #[serde(default)]
    pub source_page: String,
    #[serde(default)]
    pub alt_text: Option<String>,
    #[serde(default)]
    pub status: Option<u16>,
    #[serde(default)]
    pub status_text: String,
    #[serde(default)]
    pub is_internal: bool,
    #[serde(default)]
    pub is_insecure: bool,
    #[serde(default)]
    pub error: Option<String>,
    /// Size in bytes from the `Content-Length` response header of the HEAD request
    /// (or the GET fallback). `None` when the server sent no usable header, and for
    /// crawls saved before this field existed.
    #[serde(default)]
    pub content_length: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlProgress {
    pub crawled: usize,
    pub queued: usize,
    pub resources_checked: usize,
    pub resources_total: usize,
    pub running: bool,
    pub paused: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteInfo {
    pub llms_txt_found: bool,
    pub llms_txt_url: Option<String>,
    pub robots_txt_checked: bool,
    pub server: Option<String>,
    pub powered_by: Option<String>,
    pub cdn: Option<String>,
    pub cms: Option<String>,
    pub technologies: Vec<String>,
    pub ip_addresses: Vec<String>,
    pub hosting_org: Option<String>,
    pub hosting_country: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlSummary {
    pub pages_crawled: usize,
    pub resources_checked: usize,
    pub cancelled: bool,
    /// True when the crawl was stopped with URLs still queued and a matching
    /// `CrawlResumeState` was saved — i.e. the next `start_crawl` for this same start URL
    /// will continue rather than start over. False for a crawl that ran to completion, or
    /// one stopped with nothing left queued (nothing to resume either way).
    pub resumable: bool,
    pub linked_urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlSnapshot {
    pub start_url: String,
    pub saved_at_unix_ms: u64,
    pub pages: Vec<PageResult>,
    pub resources: Vec<ResourceResult>,
    /// Custom search rules the crawl ran with, so a loaded crawl can name the ids in
    /// `PageResult::custom_search_counts`. Empty for crawls saved before T3.3.
    #[serde(default)]
    pub custom_searches: Vec<CustomSearchRule>,
    /// Custom extraction rules the crawl ran with, so a loaded crawl can name the ids in
    /// `PageResult::extracted`. Empty for crawls saved before T3.4.
    #[serde(default)]
    pub extractions: Vec<ExtractionRule>,
}

/// Borrowed, serialize-only view of a [`CrawlSnapshot`], so `save_crawl` can write straight
/// from the locked state without cloning every page and resource first. Field names and
/// order match `CrawlSnapshot`, so a file written from this deserializes as a `CrawlSnapshot`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlSnapshotRef<'a> {
    pub start_url: &'a str,
    pub saved_at_unix_ms: u64,
    pub pages: &'a [PageResult],
    pub resources: Vec<&'a ResourceResult>,
    pub custom_searches: &'a [CustomSearchRule],
    pub extractions: &'a [ExtractionRule],
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A crawl saved before the heading outline fields (T2.1) existed must still load.
    #[test]
    fn legacy_snapshot_still_deserializes() {
        let json = include_str!("../../tests/fixtures/legacy-snapshot.json");
        let snapshot: CrawlSnapshot =
            serde_json::from_str(json).expect("legacy snapshot deserializes");
        assert_eq!(snapshot.pages.len(), 2);
        assert_eq!(snapshot.resources.len(), 1);
        let home = &snapshot.pages[0];
        assert_eq!(home.h1.as_deref(), Some("Legacy home"));
        assert_eq!(home.h1_count, 1);
        assert!(home.h1_values.is_empty());
        assert!(home.h2_values.is_empty());
        assert_eq!(home.h2_count, 0);
        assert!(home.heading_levels.is_empty());
        assert_eq!(home.title_count, 0);
        assert_eq!(home.meta_description_count, 0);
        assert_eq!(home.meta_refresh, None);
        assert_eq!(home.pagination_next, None);
        assert_eq!(home.pagination_prev, None);
        assert!(home.outlinks.is_empty());
        assert!(home.hreflang_links.is_empty());
        assert_eq!(home.images_missing_dimensions, 0);
        assert_eq!(home.content_simhash, "");
        assert!(home.custom_search_counts.is_empty());
        assert_eq!(snapshot.resources[0].content_length, None);
        assert!(snapshot.custom_searches.is_empty());
        assert!(home.extracted.is_empty());
        assert!(snapshot.extractions.is_empty());
        assert!(snapshot.pages.iter().all(|p| p.raw.is_none()));
    }

    /// A config sent without the T3.6 `compareRawHtml` field does not fetch raw HTML.
    #[test]
    fn config_without_compare_raw_html_defaults_off() {
        let config: CrawlConfig =
            serde_json::from_str(r#"{"startUrl":"https://example.com/"}"#).expect("config");
        assert!(!config.compare_raw_html);
    }

    /// A config sent without the T3.1 pattern fields means "no restriction".
    #[test]
    fn config_without_patterns_defaults_to_empty() {
        let config: CrawlConfig =
            serde_json::from_str(r#"{"startUrl":"https://example.com/"}"#).expect("config");
        assert!(config.include_patterns.is_empty());
        assert!(config.exclude_patterns.is_empty());
    }

    /// A config sent without the T3.2 `listUrls` field is a normal spider crawl.
    #[test]
    fn config_without_list_urls_is_spider_mode() {
        let config: CrawlConfig =
            serde_json::from_str(r#"{"startUrl":"https://example.com/"}"#).expect("config");
        assert!(config.list_urls.is_empty());
        assert!(!config.is_list_mode());
    }

    /// A config sent without the T3.3 `customSearches` field searches nothing, and a
    /// rule without `isRegex`/`scope` is a plain text search over the raw HTML.
    #[test]
    fn config_custom_searches_default() {
        let config: CrawlConfig =
            serde_json::from_str(r#"{"startUrl":"https://example.com/"}"#).expect("config");
        assert!(config.custom_searches.is_empty());
        let config: CrawlConfig = serde_json::from_str(
            r#"{"startUrl":"https://example.com/","customSearches":[
                {"id":"a","pattern":"x"},
                {"id":"b","name":"B","pattern":"y","isRegex":true,"scope":"text"}]}"#,
        )
        .expect("config");
        assert_eq!(config.custom_searches.len(), 2);
        assert!(!config.custom_searches[0].is_regex);
        assert_eq!(config.custom_searches[0].scope, CustomSearchScope::Html);
        assert!(config.custom_searches[1].is_regex);
        assert_eq!(config.custom_searches[1].scope, CustomSearchScope::Text);
    }

    /// A config sent without the T3.4 `extractions` field extracts nothing, and a rule
    /// without `mode` extracts text.
    #[test]
    fn config_extractions_default() {
        let config: CrawlConfig =
            serde_json::from_str(r#"{"startUrl":"https://example.com/"}"#).expect("config");
        assert!(config.extractions.is_empty());
        let config: CrawlConfig = serde_json::from_str(
            r#"{"startUrl":"https://example.com/","extractions":[
                {"id":"a","selector":".price"},
                {"id":"b","name":"B","selector":"meta","mode":"attr","attr":"content"},
                {"id":"c","selector":"main","mode":"inner_html","attr":null}]}"#,
        )
        .expect("config");
        let modes: Vec<_> = config.extractions.iter().map(|r| r.mode).collect();
        assert_eq!(
            modes,
            vec![
                ExtractionMode::Text,
                ExtractionMode::Attr,
                ExtractionMode::InnerHtml
            ]
        );
        assert_eq!(config.extractions[1].attr.as_deref(), Some("content"));
        assert_eq!(config.extractions[2].attr, None);
    }
}
