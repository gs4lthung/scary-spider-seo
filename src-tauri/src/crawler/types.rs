use serde::{Deserialize, Serialize};

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
    #[serde(default)]
    pub insecure_link_count: usize,
    #[serde(default)]
    pub missing_alt_count: usize,
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub hreflang_values: Vec<String>,
    #[serde(default)]
    pub internal_nofollow_count: usize,
    #[serde(default)]
    pub text_ratio_pct: f64,
    #[serde(default)]
    pub content_hash: String,
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
    #[serde(default)]
    pub error: Option<String>,
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
}
