//! End-to-end crawl tests against the static fixture site in `tests/fixtures/site/`
//! (see its README for which page triggers which signal). A tiny HTTP server runs
//! in-process on 127.0.0.1, and `run_crawl` runs on Tauri's mock runtime, so these
//! tests need no network, no browser and no window.

use super::crawl::{run_crawl, CrawlResumeState, CrawlState};
use super::types::{CrawlConfig, LinkRef, PageResult, ResourceResult};
use dashmap::DashMap;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::{Arc, Mutex};
use tauri::Listener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

struct FixtureServer {
    origin: String,
    /// Requests served so far, keyed by `"<METHOD> <path>"` (query string dropped).
    requests: Arc<DashMap<String, usize>>,
}

impl FixtureServer {
    async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind fixture server");
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/site");
        let requests: Arc<DashMap<String, usize>> = Arc::new(DashMap::new());
        let served_origin = origin.clone();
        let served_requests = requests.clone();
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    return;
                };
                tokio::spawn(serve_connection(
                    stream,
                    root.clone(),
                    served_origin.clone(),
                    served_requests.clone(),
                ));
            }
        });
        Self { origin, requests }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.origin, path)
    }

    /// How many `method` requests for `path` (query string dropped) were served.
    fn request_count(&self, method: &str, path: &str) -> usize {
        self.requests
            .get(&format!("{method} {path}"))
            .map_or(0, |count| *count)
    }

    /// Requests of any method whose path starts with `prefix`.
    fn request_count_with_prefix(&self, prefix: &str) -> usize {
        self.requests
            .iter()
            .filter(|entry| {
                entry
                    .key()
                    .split_once(' ')
                    .is_some_and(|(_, path)| path.starts_with(prefix))
            })
            .map(|entry| *entry.value())
            .sum()
    }

    /// Forgets every counted request, so the next crawl on this server counts from zero.
    fn reset_request_counts(&self) {
        self.requests.clear();
    }
}

/// Serves one connection. Every `/gen/` response keeps the connection open (see
/// `respond_generated`), so the large-site crawl reuses pooled connections instead of
/// opening thousands of fresh TCP connections per run, which is slow and burns
/// ephemeral ports on Windows. Every other response closes it, as it always has.
async fn serve_connection(
    mut stream: tokio::net::TcpStream,
    root: PathBuf,
    origin: String,
    requests: Arc<DashMap<String, usize>>,
) {
    let mut buf = vec![0u8; 8192];
    let mut len = 0;
    loop {
        let header_end = loop {
            if let Some(pos) = buf[..len].windows(4).position(|w| w == b"\r\n\r\n") {
                break pos + 4;
            }
            if len == buf.len() {
                return;
            }
            match stream.read(&mut buf[len..]).await {
                Ok(0) | Err(_) => return,
                Ok(n) => len += n,
            }
        };
        let request = String::from_utf8_lossy(&buf[..header_end]).into_owned();
        // The crawler only sends GET and HEAD, which have no body, so whatever follows
        // the headers already belongs to the next request on this connection.
        buf.copy_within(header_end..len, 0);
        len -= header_end;

        let mut parts = request.split_whitespace();
        let method = parts.next().unwrap_or("GET").to_string();
        let path = parts.next().unwrap_or("/").split('?').next().unwrap_or("/");
        *requests.entry(format!("{method} {path}")).or_insert(0) += 1;
        let keep_alive = path.starts_with("/gen/");
        let response = respond(&root, &origin, &method, path);
        if stream.write_all(&response).await.is_err() {
            return;
        }
        if !keep_alive {
            let _ = stream.shutdown().await;
            return;
        }
    }
}

fn http_response(status: &str, headers: &[(&str, &str)], body: &[u8], head_only: bool) -> Vec<u8> {
    http_response_on(status, headers, body, head_only, false)
}

/// Like `http_response`; `keep_alive` answers with `Connection: keep-alive` instead of
/// `Connection: close`. Only `serve_connection` knows how to keep a connection open.
fn http_response_on(
    status: &str,
    headers: &[(&str, &str)],
    body: &[u8],
    head_only: bool,
    keep_alive: bool,
) -> Vec<u8> {
    let connection = if keep_alive { "keep-alive" } else { "close" };
    let mut out = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: {connection}\r\n",
        body.len()
    );
    for (name, value) in headers {
        out.push_str(&format!("{name}: {value}\r\n"));
    }
    out.push_str("\r\n");
    let mut bytes = out.into_bytes();
    if !head_only {
        bytes.extend_from_slice(body);
    }
    bytes
}

/// Response headers `/secure-headers.html` is served with, on top of `Content-Type`.
const SECURITY_HEADERS: &[(&str, &str)] = &[
    (
        "Content-Security-Policy",
        "default-src 'self'; frame-ancestors 'none'",
    ),
    ("X-Frame-Options", "DENY"),
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "strict-origin-when-cross-origin"),
];

/// `Server` header of the start page `/`, reported in site info.
const FIXTURE_SERVER_HEADER: &str = "fixture-server";

/// Body size of `/img/large.png`, over the frontend's 100 KB `largeImage` threshold.
const LARGE_IMAGE_BYTES: usize = 150_000;

/// Number of pages in the synthetic large site served under `/gen/<n>`.
const GEN_PAGES: usize = 2000;
/// Outlinks per generated page.
const GEN_LINKS_PER_PAGE: usize = 10;

/// Targets of `/gen/<n>`'s outlinks: `(n * 7 + k) % GEN_PAGES` for k in 1..=10.
/// 7 is coprime with 2000, which is why every page is reachable from `/gen/0`
/// (checked by `gen_links_reach_every_page`).
fn gen_link_targets(n: usize) -> impl Iterator<Item = usize> {
    (1..=GEN_LINKS_PER_PAGE).map(move |k| (n * 7 + k) % GEN_PAGES)
}

/// The synthetic large site (T4.5): `/gen/<n>` for n in 0..2000 is an HTML page with a
/// unique title, 10 links to other generated pages and 2 images: `/gen/img/<n>.png`
/// (unique to the page) and `/gen/img/shared.png` (on every page). Everything is
/// generated in memory, so the throughput test measures the crawler, not disk reads.
/// Returns `None` for any path outside `/gen/`. Every `/gen/` response, 404s included,
/// keeps the connection alive (`serve_connection` relies on that).
fn respond_generated(path: &str, head: bool) -> Option<Vec<u8>> {
    let rest = path.strip_prefix("/gen/")?;
    let reply = |status: &str, headers: &[(&str, &str)], body: &[u8]| {
        http_response_on(status, headers, body, head, true)
    };
    let not_found = || reply("404 Not Found", &[], b"");
    if let Some(image) = rest.strip_prefix("img/") {
        let valid = image
            .strip_suffix(".png")
            .is_some_and(|stem| stem == "shared" || stem.parse::<usize>().is_ok());
        return Some(if valid {
            reply("200 OK", &[("Content-Type", "image/png")], b"\x89PNG")
        } else {
            not_found()
        });
    }
    let Some(n) = rest.parse::<usize>().ok().filter(|n| *n < GEN_PAGES) else {
        return Some(not_found());
    };
    let links: String = gen_link_targets(n)
        .map(|t| format!("<li><a href=\"/gen/{t}\">Generated page {t}</a></li>"))
        .collect();
    let body = format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">\
         <title>Generated page {n}</title>\
         <meta name=\"description\" content=\"Synthetic page {n} of the large fixture site.\">\
         </head><body><h1>Generated page {n}</h1>\
         <p>Filler text for generated page number {n}, used to measure crawl throughput.</p>\
         <img src=\"/gen/img/{n}.png\" alt=\"Image {n}\" width=\"4\" height=\"4\">\
         <img src=\"/gen/img/shared.png\" alt=\"Shared image\" width=\"4\" height=\"4\">\
         <ul>{links}</ul></body></html>"
    );
    Some(reply(
        "200 OK",
        &[("Content-Type", "text/html; charset=utf-8")],
        body.as_bytes(),
    ))
}

/// Routes that can't be static files (redirects, images) are handled here; everything
/// else is read from the fixture directory, with `{{ORIGIN}}` substituted.
fn respond(root: &std::path::Path, origin: &str, method: &str, path: &str) -> Vec<u8> {
    let head = method == "HEAD";
    let redirect =
        |to: &str| http_response("301 Moved Permanently", &[("Location", to)], b"", head);
    match path {
        "/old-page" => return redirect("/new-page.html"),
        "/redirect-to-gone" => return redirect("/gone.html"),
        "/start-redirect" => return redirect("/"),
        "/loop-a" => return redirect("/loop-b"),
        "/loop-b" => return redirect("/loop-a"),
        "/img/ok.png" | "/img/decorative.png" | "/img/logo.png" => {
            return http_response("200 OK", &[("Content-Type", "image/png")], b"\x89PNG", head)
        }
        "/img/large.png" => {
            return http_response(
                "200 OK",
                &[("Content-Type", "image/png")],
                &vec![0u8; LARGE_IMAGE_BYTES],
                head,
            )
        }
        _ => {}
    }
    if let Some(response) = respond_generated(path, head) {
        return response;
    }
    let file = if path == "/" {
        "index.html"
    } else {
        path.trim_start_matches('/')
    };
    if file.contains("..") {
        return http_response("400 Bad Request", &[], b"", head);
    }
    let content_type = match file.rsplit('.').next() {
        Some("html") => "text/html; charset=utf-8",
        Some("xml") => "application/xml",
        _ => "text/plain",
    };
    match std::fs::read_to_string(root.join(file)) {
        Ok(text) => {
            let body = text.replace("{{ORIGIN}}", origin);
            let mut headers = vec![("Content-Type", content_type)];
            if path == "/secure-headers.html" {
                headers.extend_from_slice(SECURITY_HEADERS);
            }
            if path == "/" {
                headers.push(("Server", FIXTURE_SERVER_HEADER));
            }
            http_response("200 OK", &headers, body.as_bytes(), head)
        }
        Err(_) => http_response(
            "404 Not Found",
            &[("Content-Type", "text/html")],
            b"<h1>Not found</h1>",
            head,
        ),
    }
}

struct CrawlOutput {
    pages: Vec<PageResult>,
    resources: Vec<ResourceResult>,
    /// Normalized internal URLs some crawled page linked to (the `run_crawl` result).
    linked_urls: Vec<String>,
    /// Every `crawl://site_info` payload the crawl emitted, in order.
    site_info: Vec<serde_json::Value>,
}

impl CrawlOutput {
    fn page(&self, url: &str) -> &PageResult {
        self.pages
            .iter()
            .find(|p| p.url == url)
            .unwrap_or_else(|| panic!("{url} was not crawled; got {:?}", self.urls()))
    }

    fn resource(&self, url: &str) -> &ResourceResult {
        self.resources
            .iter()
            .find(|r| r.url == url)
            .unwrap_or_else(|| panic!("{url} was not checked as a resource"))
    }

    fn urls(&self) -> Vec<&str> {
        let mut urls: Vec<&str> = self.pages.iter().map(|p| p.url.as_str()).collect();
        urls.sort();
        urls
    }
}

/// Crawls `start_url` with the given config overrides (camelCase `CrawlConfig` keys).
async fn crawl(start_url: &str, overrides: serde_json::Value) -> CrawlOutput {
    crawl_resumable(start_url, overrides, None, false).await.0
}

/// Like `crawl`, but can continue from `resume` and can start already stopped
/// (`stopped: true` makes the loop exit before fetching anything, leaving the whole
/// seeded frontier queued). Also returns the resume state the crawl left behind.
async fn crawl_resumable(
    start_url: &str,
    overrides: serde_json::Value,
    resume: Option<CrawlResumeState>,
    stopped: bool,
) -> (CrawlOutput, Option<CrawlResumeState>) {
    let mut config = json!({
        "startUrl": start_url,
        "concurrency": 4,
        "timeoutSecs": 5,
        "checkExternalLinks": false,
        "respectRobots": true,
    });
    config
        .as_object_mut()
        .unwrap()
        .extend(overrides.as_object().unwrap().clone());
    let config: CrawlConfig = serde_json::from_value(config).expect("valid crawl config");

    let app = tauri::test::mock_app();
    let site_info = Arc::new(Mutex::new(Vec::new()));
    let site_info_sink = site_info.clone();
    // Rust listeners run inside `emit`, so every payload is recorded before `run_crawl`
    // returns.
    app.listen("crawl://site_info", move |event| {
        let payload = serde_json::from_str(event.payload()).expect("site info is JSON");
        site_info_sink.lock().unwrap().push(payload);
    });
    let resume_slot = Arc::new(Mutex::new(None));
    let pages = Arc::new(Mutex::new(Vec::new()));
    let resources = Arc::new(DashMap::new());
    let state = CrawlState {
        cancel: Arc::new(AtomicBool::new(stopped)),
        paused: Arc::new(AtomicBool::new(false)),
        pages: pages.clone(),
        resources: resources.clone(),
        resources_checked: Arc::new(AtomicUsize::new(0)),
        resume_slot: resume_slot.clone(),
    };
    let linked_urls = run_crawl(app.handle().clone(), config, state, resume).await;

    let pages = pages.lock().unwrap().clone();
    let resources = resources.iter().map(|e| e.value().clone()).collect();
    let left_behind = resume_slot.lock().unwrap().take();
    let site_info = site_info.lock().unwrap().clone();
    (
        CrawlOutput {
            pages,
            resources,
            linked_urls,
            site_info,
        },
        left_behind,
    )
}

#[tokio::test(flavor = "multi_thread")]
async fn crawls_every_linked_page_exactly_once() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let expected: Vec<String> = [
        "/",
        "/URL_Page.html?ref=nav",
        "/a//b.html",
        "/anchors.html",
        "/bad-jsonld.html",
        "/canonical-to-noindex.html",
        "/canonical-to-redirect.html",
        "/canonicalised.html",
        "/dup-a.html",
        "/dup-b.html",
        "/en.html",
        "/fr.html",
        "/gone.html",
        "/h1-and-images.html",
        "/headings.html",
        "/loop-a",
        "/missing-title.html",
        "/multi-meta.html",
        "/near-dup-a.html",
        "/near-dup-b.html",
        "/nofollow.html",
        "/noindex.html",
        "/old-page",
        "/paged-1.html",
        "/paged-2.html",
        "/private/secret.html",
        "/product.html",
        "/redirect-to-gone",
        "/secure-headers.html",
        "/title-equals-h1.html",
    ]
    .iter()
    .map(|p| site.url(p))
    .collect();
    assert_eq!(out.urls(), expected);
}

#[tokio::test(flavor = "multi_thread")]
async fn start_url_is_fetched_once() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;
    assert_eq!(out.page(&site.url("/")).status, Some(200));
    // Site info takes its technologies from the crawl's own fetch of `/`.
    assert_eq!(site.request_count("GET", "/"), 1, "GET / requests");
    assert_eq!(site.request_count("HEAD", "/"), 0, "HEAD / requests");
}

#[tokio::test(flavor = "multi_thread")]
async fn site_info_still_reports_technologies() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;
    assert_eq!(out.site_info.len(), 1, "site info is emitted once");
    let info = &out.site_info[0];
    assert_eq!(info["server"], FIXTURE_SERVER_HEADER);
    assert_eq!(info["llmsTxtUrl"], site.url("/llms.txt"));
    assert_eq!(info["robotsTxtChecked"], true);
    assert_eq!(info["ipAddresses"], json!(["127.0.0.1"]));
}

#[tokio::test(flavor = "multi_thread")]
async fn resumed_crawl_sends_no_site_info() {
    let site = FixtureServer::start().await;
    let start = site.url("/");
    let queued = site.url("/dup-a.html");
    // The first run already fetched `/`, so only `/dup-a.html` is left to crawl.
    let resume = CrawlResumeState {
        start_url: start.clone(),
        frontier: [(url::Url::parse(&queued).unwrap(), 1, false)].into(),
        visited: [start.clone(), queued.clone()].into(),
        scheduled_count: 2,
        crawled_count: 1,
        linked_urls: Default::default(),
    };
    let (out, _) = crawl_resumable(&start, json!({ "maxDepth": 1 }), Some(resume), false).await;
    assert_eq!(out.urls(), vec![queued.as_str()]);
    assert_eq!(
        site.request_count("GET", "/"),
        0,
        "the start page is not refetched"
    );
    // The first run's site info (with technologies) stays what the user sees.
    assert!(out.site_info.is_empty(), "{:?}", out.site_info);
    assert_eq!(
        site.request_count("GET", "/llms.txt"),
        0,
        "no site info lookups"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn resumed_crawl_with_the_start_page_queued_reports_technologies() {
    let site = FixtureServer::start().await;
    let start = site.url("/");
    // Stopped before anything was fetched, so `/` is still queued.
    let (_, resume) = crawl_resumable(&start, json!({}), None, true).await;
    let resume = resume.expect("a stopped crawl leaves resume state");
    let (out, _) = crawl_resumable(&start, json!({ "maxDepth": 0 }), Some(resume), false).await;
    assert_eq!(out.urls(), vec![start.as_str()]);
    assert_eq!(out.site_info.len(), 1, "site info is emitted once");
    assert_eq!(out.site_info[0]["server"], FIXTURE_SERVER_HEADER);
    assert_eq!(site.request_count("GET", "/"), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_reports_technologies_when_the_start_url_is_listed() {
    let site = FixtureServer::start().await;
    let start = site.url("/");
    let out = crawl(
        &start,
        json!({ "listUrls": [&start, site.url("/dup-a.html")] }),
    )
    .await;
    assert_eq!(out.pages.len(), 2);
    assert_eq!(out.site_info.len(), 1, "site info is emitted once");
    assert_eq!(out.site_info[0]["server"], FIXTURE_SERVER_HEADER);
    assert_eq!(site.request_count("GET", "/"), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_sends_site_info_once_when_the_start_url_is_not_listed() {
    let site = FixtureServer::start().await;
    let dup_a = site.url("/dup-a.html");
    let out = crawl(&site.url("/"), json!({ "listUrls": [&dup_a] })).await;
    assert_eq!(out.urls(), vec![dup_a.as_str()]);
    assert_eq!(out.site_info.len(), 1, "site info is emitted once");
    // `/` is neither crawled nor probed, so there is nothing to detect from.
    assert_eq!(out.site_info[0]["server"], serde_json::Value::Null);
    assert_eq!(out.site_info[0]["llmsTxtUrl"], site.url("/llms.txt"));
    assert_eq!(site.request_count("GET", "/"), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn redirecting_start_page_reports_the_target_headers() {
    let site = FixtureServer::start().await;
    // `/start-redirect` answers 301 without a `Server` header; its target `/` has one.
    let start = site.url("/start-redirect");
    let out = crawl(&start, json!({ "maxDepth": 0 })).await;
    assert_eq!(out.page(&start).redirect_url, Some(site.url("/")));
    assert_eq!(out.site_info.len(), 1, "site info is emitted once");
    assert_eq!(out.site_info[0]["server"], FIXTURE_SERVER_HEADER);
    assert_eq!(site.request_count("GET", "/start-redirect"), 1);
    assert_eq!(site.request_count("GET", "/"), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn site_info_is_emitted_when_stopped_before_the_start_page() {
    let site = FixtureServer::start().await;
    let (out, _) = crawl_resumable(&site.url("/"), json!({}), None, true).await;
    assert!(out.pages.is_empty());
    assert_eq!(out.site_info.len(), 1, "site info is emitted once");
    assert_eq!(out.site_info[0]["server"], serde_json::Value::Null);
    assert_eq!(site.request_count("GET", "/"), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn exclude_pattern_skips_matching_pages() {
    let site = FixtureServer::start().await;
    let full = crawl(&site.url("/"), json!({})).await;
    let out = crawl(&site.url("/"), json!({ "excludePatterns": ["/dup-"] })).await;

    let dup_a = site.url("/dup-a.html");
    let dup_b = site.url("/dup-b.html");
    let expected: Vec<&str> = full
        .urls()
        .into_iter()
        .filter(|u| *u != dup_a && *u != dup_b)
        .collect();
    assert_eq!(out.urls(), expected);
    // `/near-dup-*` pages don't contain "/dup-" and are still crawled.
    out.page(&site.url("/near-dup-a.html"));
    // Excluded URLs still count as linked, so orphan detection is unaffected.
    assert!(out.linked_urls.contains(&dup_a), "{:?}", out.linked_urls);
    assert!(out.linked_urls.contains(&dup_b), "{:?}", out.linked_urls);
}

#[tokio::test(flavor = "multi_thread")]
async fn include_pattern_limits_the_crawl() {
    let site = FixtureServer::start().await;
    // Anchored on the path segment: a bare "noindex" would also match
    // `/canonical-to-noindex.html`, which the fixture site links from the home page.
    let out = crawl(
        &site.url("/"),
        json!({ "includePatterns": [r"/noindex\.html$"] }),
    )
    .await;
    // The start URL is always crawled even though it doesn't match.
    assert_eq!(out.urls(), vec![site.url("/"), site.url("/noindex.html")]);
}

#[tokio::test(flavor = "multi_thread")]
async fn include_pattern_applies_to_sitemap_urls() {
    let site = FixtureServer::start().await;
    let out = crawl(
        &site.url("/"),
        json!({ "useSitemap": true, "includePatterns": ["/noindex"] }),
    )
    .await;
    // `/noindex-in-sitemap.html` is only reachable through the sitemap and matches;
    // every other sitemap URL is filtered out.
    let urls = out.urls();
    assert!(
        urls.contains(&site.url("/noindex-in-sitemap.html").as_str()),
        "{urls:?}"
    );
    assert!(
        urls.iter()
            .all(|u| *u == site.url("/") || u.contains("/noindex")),
        "{urls:?}"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn resumed_crawl_drops_queued_urls_the_new_scope_excludes() {
    let site = FixtureServer::start().await;
    let start = site.url("/");
    // Stopped before anything is fetched: the frontier holds `/` plus the sitemap URLs.
    let (stopped, resume) =
        crawl_resumable(&start, json!({ "useSitemap": true }), None, true).await;
    assert!(stopped.pages.is_empty());
    let resume = resume.expect("a stopped crawl with a queued frontier leaves resume state");
    let queued: Vec<String> = resume
        .frontier
        .iter()
        .map(|(u, _, _)| u.to_string())
        .collect();
    let orphan = site.url("/orphan.html");
    let gone = site.url("/gone-in-sitemap.html");
    assert!(
        queued.contains(&orphan) && queued.contains(&gone),
        "{queued:?}"
    );
    let scheduled_before = resume.scheduled_count;

    // Resumed with patterns that exclude two queued URLs, and one that matches the start
    // URL too (which is still crawled). Depth 0 keeps the crawl to the queued URLs.
    let (out, left) = crawl_resumable(
        &start,
        json!({ "maxDepth": 0, "excludePatterns": ["orphan", "gone-", "/$"] }),
        Some(resume),
        false,
    )
    .await;
    assert!(left.is_none());
    let urls = out.urls();
    assert!(urls.contains(&start.as_str()), "{urls:?}");
    assert!(!urls.contains(&orphan.as_str()), "{urls:?}");
    assert!(!urls.contains(&gone.as_str()), "{urls:?}");
    assert!(
        urls.contains(&site.url("/noindex-in-sitemap.html").as_str()),
        "{urls:?}"
    );
    assert!(scheduled_before > urls.len());
}

#[tokio::test(flavor = "multi_thread")]
async fn custom_search_counts() {
    let site = FixtureServer::start().await;
    let out = crawl(
        &site.url("/"),
        json!({ "customSearches": [
            { "id": "dup", "name": "Duplicate", "pattern": "Duplicate" },
            { "id": "dup-text", "name": "Duplicate text", "pattern": "duplicate", "scope": "text" },
            { "id": "h1", "name": "H1 tag", "pattern": r"<h1>\w+</h1>", "isRegex": true },
        ] }),
    )
    .await;

    let dup_a = &out.page(&site.url("/dup-a.html")).custom_search_counts;
    // The title, the H1 and the body text ("duplicate pages").
    assert!(dup_a["dup"] >= 2, "{dup_a:?}");
    assert_eq!(dup_a["dup"], 3, "{dup_a:?}");
    // Visible body text only: the H1 and the paragraph, not the <title> in the head.
    assert_eq!(dup_a["dup-text"], 2, "{dup_a:?}");
    assert_eq!(dup_a["h1"], 1, "{dup_a:?}");

    let noindex = &out.page(&site.url("/noindex.html")).custom_search_counts;
    assert_eq!(noindex["dup"], 0, "{noindex:?}");
    assert_eq!(noindex["dup-text"], 0, "{noindex:?}");
    assert_eq!(noindex["h1"], 1, "{noindex:?}");

    // A robots-blocked URL is never fetched, so it has no counts at all (neither
    // "contains" nor "does not contain" in the frontend).
    let blocked = out.page(&site.url("/private/secret.html"));
    assert!(blocked.custom_search_counts.is_empty(), "{blocked:?}");
    // Without rules nothing is recorded.
    let plain = crawl(&site.url("/"), json!({ "maxPages": 1 })).await;
    assert!(plain.page(&site.url("/")).custom_search_counts.is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn extraction_fixture() {
    let site = FixtureServer::start().await;
    let out = crawl(
        &site.url("/"),
        json!({ "extractions": [
            { "id": "price", "name": "Price", "selector": ".price" },
            { "id": "og", "name": "OG image", "selector": "meta[property=\"og:image\"]",
              "mode": "attr", "attr": "content" },
            { "id": "ld", "name": "JSON-LD", "selector": "script[type=\"application/ld+json\"]",
              "mode": "inner_html" },
        ] }),
    )
    .await;

    let product = &out.page(&site.url("/product.html")).extracted;
    assert_eq!(product["price"], vec!["$19.99"], "{product:?}");
    assert_eq!(product["og"], vec![site.url("/img/ok.png")], "{product:?}");
    // Scripts are still in the document when extraction runs.
    assert_eq!(product["ld"].len(), 1, "{product:?}");
    assert!(product["ld"][0].contains("\"Product\""), "{product:?}");

    // A page without the elements still gets an (empty) entry per rule.
    let home = &out.page(&site.url("/")).extracted;
    assert!(home["price"].is_empty(), "{home:?}");
    assert!(home["og"].is_empty(), "{home:?}");
    // A robots-blocked URL is never fetched, so it has no entries at all.
    let blocked = out.page(&site.url("/private/secret.html"));
    assert!(blocked.extracted.is_empty(), "{blocked:?}");
    // Without rules nothing is recorded.
    let plain = crawl(&site.url("/"), json!({ "maxPages": 1 })).await;
    assert!(plain.page(&site.url("/")).extracted.is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_crawls_only_the_listed_urls() {
    let site = FixtureServer::start().await;
    let noindex = site.url("/noindex.html");
    let gone = site.url("/gone.html");
    let dup_a = site.url("/dup-a.html");
    let out = crawl(
        &noindex,
        json!({
            // Duplicates, a fragment variant and unparsable entries are ignored.
            "listUrls": [&noindex, &gone, &dup_a, format!("{dup_a}#top"), "not a url", "ftp://x/"],
            "useSitemap": true,
        }),
    )
    .await;

    // Every listed page links to `/`, which is not crawled; no sitemap URL is either.
    let mut expected = vec![dup_a.clone(), gone.clone(), noindex.clone()];
    expected.sort();
    assert_eq!(out.urls(), expected);
    assert!(out.pages.iter().all(|p| p.depth == 0));
    assert_eq!(out.page(&gone).status, Some(404));
    // Links are still recorded as linked even though they are not followed.
    assert!(
        out.linked_urls.contains(&site.url("/")),
        "{:?}",
        out.linked_urls
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_checks_images_of_listed_pages() {
    let site = FixtureServer::start().await;
    let page = site.url("/h1-and-images.html");
    let out = crawl(&page, json!({ "listUrls": [&page] })).await;
    assert_eq!(out.urls(), vec![page.as_str()]);
    let image = out.resource(&site.url("/img/ok.png"));
    assert_eq!(image.status, Some(200));
    assert!(image.is_internal);
}

/// A throwaway origin for list-mode tests: every request is answered by `handler(path)`,
/// which may wait before answering. Returns the origin, e.g. `http://127.0.0.1:1234`.
async fn start_custom_server<F, Fut>(handler: F) -> String
where
    F: Fn(String) -> Fut + Clone + Send + Sync + 'static,
    Fut: std::future::Future<Output = Vec<u8>> + Send + 'static,
{
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind custom server");
    let origin = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                return;
            };
            let handler = handler.clone();
            tokio::spawn(async move {
                let mut buf = vec![0u8; 8192];
                let mut len = 0;
                while !buf[..len].windows(4).any(|w| w == b"\r\n\r\n") && len < buf.len() {
                    match stream.read(&mut buf[len..]).await {
                        Ok(0) | Err(_) => return,
                        Ok(n) => len += n,
                    }
                }
                let request = String::from_utf8_lossy(&buf[..len]).into_owned();
                let path = request.split_whitespace().nth(1).unwrap_or("/").to_string();
                let response = handler(path).await;
                let _ = stream.write_all(&response).await;
                let _ = stream.shutdown().await;
            });
        }
    });
    origin
}

fn html_ok() -> Vec<u8> {
    http_response(
        "200 OK",
        &[("Content-Type", "text/html; charset=utf-8")],
        b"<!doctype html><title>Listed</title><h1>Listed</h1>",
        false,
    )
}

fn robots_txt(body: &str) -> Vec<u8> {
    http_response(
        "200 OK",
        &[("Content-Type", "text/plain")],
        body.as_bytes(),
        false,
    )
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_respects_robots_per_host() {
    // The start origin (the fixture site) disallows `/private/` only. The second origin
    // disallows `/members/`, so `/members/page.html` can only come back blocked if list
    // mode fetches the second origin's own robots.txt.
    let site = FixtureServer::start().await;
    let other = start_custom_server(|path: String| async move {
        if path == "/robots.txt" {
            robots_txt("User-agent: *\nDisallow: /members/\n")
        } else {
            html_ok()
        }
    })
    .await;
    let members = format!("{other}/members/page.html");
    let open = format!("{other}/open.html");
    let listed = vec![
        site.url("/noindex.html"),
        site.url("/private/secret.html"),
        members.clone(),
        open.clone(),
    ];
    let out = crawl(&listed[0], json!({ "listUrls": &listed })).await;

    assert_eq!(out.pages.len(), 4);
    for blocked in [&members, &site.url("/private/secret.html")] {
        let page = out.page(blocked);
        assert_eq!(page.status_text, "Blocked", "{blocked}");
        assert_eq!(page.indexability, "Non-Indexable (robots.txt)", "{blocked}");
    }
    assert_eq!(out.page(&open).status, Some(200));
    assert_eq!(out.page(&site.url("/noindex.html")).status, Some(200));
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_fetches_robots_off_the_dispatch_path() {
    // The gated origin answers its robots.txt only once the signal origin has received a
    // request. If robots.txt were fetched on the dispatch path, the signal URL (listed
    // after it) could not be dispatched until that fetch gave up, the gated rules would be
    // lost, and `/gated/page.html` would be crawled instead of blocked. No timing involved.
    let site = FixtureServer::start().await;
    let (signal_tx, signal_rx) = tokio::sync::watch::channel(false);
    let signal_tx = Arc::new(signal_tx);
    let gated = start_custom_server(move |path: String| {
        let mut signal_rx = signal_rx.clone();
        async move {
            if path == "/robots.txt" {
                // Safety net so a regression fails the assertion instead of hanging.
                let _ = tokio::time::timeout(
                    std::time::Duration::from_secs(20),
                    signal_rx.wait_for(|fired| *fired),
                )
                .await;
                robots_txt("User-agent: *\nDisallow: /gated/\n")
            } else {
                html_ok()
            }
        }
    })
    .await;
    let signal = start_custom_server(move |_path: String| {
        let signal_tx = signal_tx.clone();
        async move {
            signal_tx.send_replace(true);
            html_ok()
        }
    })
    .await;
    // An origin nobody listens on: its robots.txt and page both fail fast, and the crawl
    // still finishes.
    let dead = {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        format!("http://{}", listener.local_addr().unwrap())
    };

    let gated_page = format!("{gated}/gated/page.html");
    let dead_page = format!("{dead}/page.html");
    let signal_page = format!("{signal}/page.html");
    let listed = vec![
        site.url("/noindex.html"),
        gated_page.clone(),
        dead_page.clone(),
        signal_page.clone(),
    ];
    let out = crawl(
        &listed[0],
        json!({ "listUrls": &listed, "concurrency": 4, "timeoutSecs": 5 }),
    )
    .await;

    assert_eq!(out.pages.len(), 4, "{:?}", out.urls());
    let gated_result = out.page(&gated_page);
    assert_eq!(gated_result.status_text, "Blocked");
    assert_eq!(gated_result.indexability, "Non-Indexable (robots.txt)");
    assert_eq!(out.page(&signal_page).status, Some(200));
    let dead_result = out.page(&dead_page);
    assert_eq!(dead_result.status, None);
    assert!(dead_result.error.is_some());
}

#[tokio::test(flavor = "multi_thread")]
async fn list_mode_never_uses_or_leaves_resume_state() {
    let site = FixtureServer::start().await;
    let start = site.url("/");
    let (_, spider_resume) = crawl_resumable(&start, json!({}), None, true).await;
    let spider_resume = spider_resume.expect("stopped spider crawl leaves resume state");

    let listed = vec![start.clone(), site.url("/noindex.html")];
    // A stopped list crawl leaves nothing to resume.
    let (_, left) = crawl_resumable(&start, json!({ "listUrls": &listed }), None, true).await;
    assert!(left.is_none());
    // A resume state handed to a list crawl is ignored: the list is crawled from scratch.
    let (out, left) = crawl_resumable(
        &start,
        json!({ "listUrls": &listed }),
        Some(spider_resume),
        false,
    )
    .await;
    assert!(left.is_none());
    let mut expected = listed.clone();
    expected.sort();
    assert_eq!(out.urls(), expected);
}

#[tokio::test(flavor = "multi_thread")]
async fn extracts_on_page_signals() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let home = out.page(&site.url("/"));
    assert_eq!(home.status, Some(200));
    assert_eq!(
        home.title.as_deref(),
        Some("Fixture Home: a well formed page for tests")
    );
    assert_eq!(home.title_length, 42);
    assert!(home.meta_description.is_some());
    assert_eq!(home.h1_count, 1);
    assert_eq!(home.lang.as_deref(), Some("en"));
    assert!(home.viewport.is_some());
    assert!(home.has_open_graph);
    assert_eq!(home.canonical.as_deref(), Some(site.url("/").as_str()));
    assert_eq!(home.canonical_count, 1);
    assert_eq!(home.structured_data_types, vec!["WebSite"]);
    assert!(home.structured_data_errors.is_empty());
    assert_eq!(home.indexability, "Indexable");
    assert_eq!(home.internal_link_count, 27);
    assert_eq!(home.external_link_count, 1);

    let bare = out.page(&site.url("/missing-title.html"));
    assert_eq!(bare.title, None);
    assert_eq!(bare.meta_description, None);
    assert_eq!(bare.h1_count, 0);
    assert_eq!(bare.lang, None);
    assert_eq!(bare.viewport, None);

    let (a, b) = (
        out.page(&site.url("/dup-a.html")),
        out.page(&site.url("/dup-b.html")),
    );
    assert_eq!(a.title, b.title);
    assert_eq!(a.meta_description, b.meta_description);
    assert!(!a.content_hash.is_empty());
    assert_eq!(a.content_hash, b.content_hash);
    assert_ne!(a.content_hash, home.content_hash);

    let images = out.page(&site.url("/h1-and-images.html"));
    assert_eq!(images.h1_count, 2);
    assert_eq!(images.image_count, 4);
    // alt="" marks a decorative image and is deliberately not counted as missing.
    assert_eq!(images.missing_alt_count, 1);
    // Only /img/ok.png carries both width and height.
    assert_eq!(images.images_missing_dimensions, 3);

    let bad = out.page(&site.url("/bad-jsonld.html"));
    assert_eq!(bad.structured_data_errors.len(), 1);
    assert!(bad.structured_data_types.is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn url_audit_fixtures_are_crawled_verbatim() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // The frontend's URL structure checks read `page.url`, so case, the query string
    // and the repeated slash must survive link resolution and normalisation untouched.
    for path in ["/URL_Page.html?ref=nav", "/a//b.html"] {
        let page = out.page(&site.url(path));
        assert_eq!(page.status, Some(200), "{path}");
        assert_eq!(page.url, site.url(path));
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn title_equals_h1_fixture() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's titleSameAsH1 and metaTooLong checks.
    let page = out.page(&site.url("/title-equals-h1.html"));
    assert_eq!(page.status, Some(200));
    assert_eq!(page.title.as_deref(), Some("Title Equals H1 Fixture"));
    assert_eq!(page.title, page.h1);
    assert!(
        page.meta_description_length > 155,
        "{}",
        page.meta_description_length
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn headings_fixture() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's missingH2 and nonSequentialHeadings checks.
    let page = out.page(&site.url("/headings.html"));
    assert_eq!(page.status, Some(200));
    assert_eq!(page.h2_count, 0);
    assert!(page.h2_values.is_empty());
    assert_eq!(page.heading_levels, vec![1, 3]);
    assert_eq!(page.h1_values, vec!["Heading outline fixture"]);

    let images = out.page(&site.url("/h1-and-images.html"));
    assert_eq!(images.h1_values.len(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn multi_meta_fixture() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's multipleTitles, multipleMetaDescriptions and
    // metaRefresh checks.
    let page = out.page(&site.url("/multi-meta.html"));
    assert_eq!(page.status, Some(200));
    assert_eq!(page.title_count, 2);
    assert_eq!(page.title.as_deref(), Some("Multiple Meta Fixture"));
    assert_eq!(page.meta_description_count, 2);
    assert_eq!(page.meta_refresh.as_deref(), Some("30; url=/"));

    let home = out.page(&site.url("/"));
    assert_eq!(home.title_count, 1);
    assert_eq!(home.meta_description_count, 1);
    assert_eq!(home.meta_refresh, None);
    assert_eq!(home.pagination_next, None);
}

#[tokio::test(flavor = "multi_thread")]
async fn anchors_fixture() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's link analysis: every internal link in document
    // order with its anchor and rel flags, duplicates kept, external links left out.
    let page = out.page(&site.url("/anchors.html"));
    assert_eq!(page.status, Some(200));
    let link = |path: &str, anchor: &str, nofollow: bool, is_image_link: bool| LinkRef {
        url: site.url(path),
        anchor: anchor.to_string(),
        nofollow,
        is_image_link,
    };
    assert_eq!(
        page.outlinks,
        vec![
            link("/", "Fixture home", false, false),
            link("/dup-a.html", "Duplicate page A", false, true),
            link("/dup-b.html", "", false, false),
            link("/headings.html", "click here", false, false),
            link("/nofollow.html", "User submitted link", true, false),
            link("/", "Home again", false, false),
        ]
    );
    assert_eq!(page.internal_link_count, 6);
    assert_eq!(page.internal_nofollow_count, 1);

    let home = out.page(&site.url("/"));
    assert_eq!(home.outlinks.len(), home.internal_link_count);
    assert!(home
        .outlinks
        .iter()
        .any(|l| l.url == site.url("/anchors.html") && l.anchor == "Anchor text and rel values"));
}

#[tokio::test(flavor = "multi_thread")]
async fn pagination_target_is_crawled() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's paginationTargetError check: the rel=next target is
    // linked from no anchor, so it is only crawled because pagination links are queued.
    let paged = out.page(&site.url("/paged-1.html"));
    assert_eq!(
        paged.pagination_next.as_deref(),
        Some(site.url("/paged-2.html").as_str())
    );
    assert_eq!(
        paged.pagination_prev.as_deref(),
        Some(site.url("/").as_str())
    );
    assert_eq!(paged.internal_link_count, 0);
    assert_eq!(out.page(&site.url("/paged-2.html")).status, Some(404));
}

#[tokio::test(flavor = "multi_thread")]
async fn hreflang_fixtures() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let pairs = |page: &PageResult| -> Vec<(String, String)> {
        page.hreflang_links
            .iter()
            .map(|l| (l.lang.clone(), l.href.clone()))
            .collect()
    };
    let en = out.page(&site.url("/en.html"));
    assert_eq!(
        pairs(en),
        vec![
            ("en".to_string(), site.url("/en.html")),
            ("fr".to_string(), site.url("/fr.html")),
            ("x-default".to_string(), site.url("/")),
        ]
    );
    assert_eq!(en.hreflang_values, vec!["en", "fr", "x-default"]);

    // /fr.html is linked from no anchor: it is crawled only because hreflang
    // targets are queued like internal links.
    let fr = out.page(&site.url("/fr.html"));
    assert_eq!(fr.status, Some(200));
    assert_eq!(fr.internal_link_count, 0);
    assert_eq!(
        pairs(fr),
        vec![
            ("fr".to_string(), site.url("/fr.html")),
            ("fr-XX".to_string(), site.url("/fr.html")),
        ]
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn near_duplicate_fixtures() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let a = out.page(&site.url("/near-dup-a.html"));
    let b = out.page(&site.url("/near-dup-b.html"));
    assert_eq!(a.content_simhash.len(), 16);
    assert_eq!(b.content_simhash.len(), 16);
    let fingerprint = |p: &PageResult| u64::from_str_radix(&p.content_simhash, 16).unwrap();
    let distance = (fingerprint(a) ^ fingerprint(b)).count_ones();
    assert!(distance <= 3, "near-duplicate distance {distance}");
    assert_ne!(a.content_hash, b.content_hash);

    // The home page is short but over the word minimum; a different page is far away.
    let home = out.page(&site.url("/"));
    assert_eq!(home.content_simhash.len(), 16);
    assert!((fingerprint(a) ^ fingerprint(home)).count_ones() > 3);
    // Pages under 20 words carry no fingerprint.
    assert_eq!(out.page(&site.url("/en.html")).content_simhash, "");
    // Non-HTML and failed URLs carry no fingerprint.
    assert_eq!(out.page(&site.url("/gone.html")).content_simhash, "");
}

#[tokio::test(flavor = "multi_thread")]
async fn directive_and_canonical_fixtures() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's directive and canonical checks.
    let nofollow = out.page(&site.url("/nofollow.html"));
    assert_eq!(nofollow.meta_robots.as_deref(), Some("nofollow"));
    assert_eq!(nofollow.indexability, "Indexable");

    let to_noindex = out.page(&site.url("/canonical-to-noindex.html"));
    assert_eq!(
        to_noindex.canonical.as_deref(),
        Some(site.url("/noindex.html").as_str())
    );
    assert_eq!(to_noindex.indexability, "Canonicalised");
    assert_eq!(
        out.page(&site.url("/noindex.html")).indexability,
        "Non-Indexable (noindex)"
    );

    let to_redirect = out.page(&site.url("/canonical-to-redirect.html"));
    assert_eq!(
        to_redirect.canonical.as_deref(),
        Some(site.url("/old-page").as_str())
    );
    assert!(out.page(&site.url("/old-page")).redirect_url.is_some());
}

#[tokio::test(flavor = "multi_thread")]
async fn captures_security_headers() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let secure = out.page(&site.url("/secure-headers.html"));
    assert!(secure.security_headers_captured);
    assert_eq!(
        secure.content_security_policy.as_deref(),
        Some("default-src 'self'; frame-ancestors 'none'")
    );
    assert_eq!(secure.x_frame_options.as_deref(), Some("DENY"));
    assert_eq!(secure.x_content_type_options.as_deref(), Some("nosniff"));
    assert_eq!(
        secure.referrer_policy.as_deref(),
        Some("strict-origin-when-cross-origin")
    );
    // The fixture server is plain HTTP, so nothing counts as mixed content.
    assert_eq!(secure.mixed_content_count, 0);

    let home = out.page(&site.url("/"));
    assert!(home.security_headers_captured);
    assert_eq!(home.content_security_policy, None);
    assert_eq!(home.x_frame_options, None);
    assert_eq!(home.x_content_type_options, None);
    assert_eq!(home.referrer_policy, None);
}

#[tokio::test(flavor = "multi_thread")]
async fn classifies_indexability() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    assert_eq!(
        out.page(&site.url("/noindex.html")).indexability,
        "Non-Indexable (noindex)"
    );
    assert_eq!(
        out.page(&site.url("/canonicalised.html")).indexability,
        "Canonicalised"
    );

    let gone = out.page(&site.url("/gone.html"));
    assert_eq!(gone.status, Some(404));
    assert_eq!(gone.indexability, "Non-Indexable (404)");

    let blocked = out.page(&site.url("/private/secret.html"));
    assert_eq!(blocked.status, None);
    assert_eq!(blocked.indexability, "Non-Indexable (robots.txt)");
}

#[tokio::test(flavor = "multi_thread")]
async fn follows_and_reports_redirects() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let moved = out.page(&site.url("/old-page"));
    assert_eq!(moved.status, Some(200));
    assert_eq!(
        moved.redirect_url.as_deref(),
        Some(site.url("/new-page.html").as_str())
    );
    assert_eq!(moved.redirect_chain, vec![site.url("/old-page")]);
    assert_eq!(moved.indexability, "Redirected");

    let looped = out.page(&site.url("/loop-a"));
    assert_eq!(looped.status, Some(301));
    assert!(
        looped.status_text.contains("redirect loop"),
        "status text was {:?}",
        looped.status_text
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn redirect_to_gone_reports_final_404() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signals for the frontend's redirectToError and internalRedirect checks: the
    // requested URL carries the final status and the hops that led there.
    let page = out.page(&site.url("/redirect-to-gone"));
    assert_eq!(page.status, Some(404));
    assert_eq!(page.redirect_chain, vec![site.url("/redirect-to-gone")]);
    assert!(
        page.redirect_url
            .as_deref()
            .is_some_and(|u| u.ends_with("/gone.html")),
        "redirect_url was {:?}",
        page.redirect_url
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn checks_image_resources() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    assert_eq!(out.resource(&site.url("/img/ok.png")).status, Some(200));
    assert_eq!(
        out.resource(&site.url("/img/missing.png")).status,
        Some(404)
    );
    let described = out.resource(&site.url("/img/ok.png"));
    assert_eq!(described.alt_text.as_deref(), Some("A described image"));
    assert_eq!(described.source_page, site.url("/h1-and-images.html"));
}

#[tokio::test(flavor = "multi_thread")]
async fn records_image_content_length() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    // Raw signal for the frontend's largeImage check, read from the HEAD response.
    let large = out.resource(&site.url("/img/large.png"));
    assert_eq!(large.status, Some(200));
    assert_eq!(large.content_length, Some(LARGE_IMAGE_BYTES as u64));
    assert_eq!(
        out.resource(&site.url("/img/ok.png")).content_length,
        Some(4)
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn ignores_robots_when_not_respected() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({ "respectRobots": false })).await;

    let secret = out.page(&site.url("/private/secret.html"));
    assert_eq!(secret.status, Some(200));
    assert_eq!(secret.indexability, "Indexable");
}

#[tokio::test(flavor = "multi_thread")]
async fn honors_page_and_depth_limits() {
    let site = FixtureServer::start().await;

    let capped = crawl(&site.url("/"), json!({ "maxPages": 3 })).await;
    assert_eq!(capped.pages.len(), 3);

    let shallow = crawl(&site.url("/"), json!({ "maxDepth": 0 })).await;
    assert_eq!(shallow.urls(), vec![site.url("/")]);
}

#[tokio::test(flavor = "multi_thread")]
async fn seeds_orphans_from_the_sitemap() {
    let site = FixtureServer::start().await;

    let without = crawl(&site.url("/"), json!({})).await;
    assert!(without
        .pages
        .iter()
        .all(|p| p.url != site.url("/orphan.html")));

    let with = crawl(&site.url("/"), json!({ "useSitemap": true })).await;
    let orphan = with.page(&site.url("/orphan.html"));
    assert!(orphan.discovered_via_sitemap);
    assert!(!with.page(&site.url("/dup-a.html")).discovered_via_sitemap);

    // Sitemap audits: a noindex URL and a 404 URL, both listed only in the sitemap.
    let noindex = with.page(&site.url("/noindex-in-sitemap.html"));
    assert!(noindex.discovered_via_sitemap);
    assert_eq!(noindex.indexability, "Non-Indexable (noindex)");

    let gone = with.page(&site.url("/gone-in-sitemap.html"));
    assert!(gone.discovered_via_sitemap);
    assert_eq!(gone.status, Some(404));

    // A robots.txt-disallowed URL listed only in the sitemap keeps its sitemap flag.
    let blocked = with.page(&site.url("/private/in-sitemap.html"));
    assert!(blocked.discovered_via_sitemap);
    assert_eq!(blocked.indexability, "Non-Indexable (robots.txt)");
}

/// Without JS rendering there is no rendered HTML to compare, so `compareRawHtml` alone
/// records nothing and the page is fetched and parsed exactly as before.
#[tokio::test(flavor = "multi_thread")]
async fn compare_raw_html_without_rendering_records_nothing() {
    let site = FixtureServer::start().await;
    let out = crawl(
        &site.url("/js-title.html"),
        json!({ "compareRawHtml": true, "maxPages": 1 }),
    )
    .await;
    let page = out.page(&site.url("/js-title.html"));
    assert!(!page.rendered);
    assert!(page.raw.is_none(), "{:?}", page.raw);
    assert_eq!(page.title.as_deref(), Some("Raw title before JavaScript"));
    assert_eq!(page.internal_link_count, 1);
}

/// Needs a local Chrome/Chromium, which CI and the gate do not have.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires Chrome; run with `cargo test -- --ignored`"]
async fn js_rendering_changes_are_captured() {
    let site = FixtureServer::start().await;
    let out = crawl(
        &site.url("/js-title.html"),
        json!({ "renderJs": true, "compareRawHtml": true, "maxPages": 1, "checkImages": false }),
    )
    .await;
    let page = out.page(&site.url("/js-title.html"));
    assert!(page.rendered, "Chrome did not render the page: {page:?}");
    assert_eq!(
        page.title.as_deref(),
        Some("Rendered title set by JavaScript")
    );
    assert_eq!(page.internal_link_count, 11);
    let raw = page.raw.as_ref().expect("raw signals recorded");
    assert_eq!(raw.title.as_deref(), Some("Raw title before JavaScript"));
    assert_eq!(raw.h1.as_deref(), Some("JavaScript changes this page"));
    assert_eq!(raw.internal_link_count, 1);
    assert!(raw.word_count < page.word_count);

    // Rendering without the comparison option leaves `raw` unset.
    let plain = crawl(
        &site.url("/js-title.html"),
        json!({ "renderJs": true, "maxPages": 1, "checkImages": false }),
    )
    .await;
    assert!(plain.page(&site.url("/js-title.html")).raw.is_none());
}

/// Breadth-first link depth of every `/gen/<n>` page from `/gen/0` (`None` if unreachable).
fn gen_link_depths() -> Vec<Option<usize>> {
    let mut depths = vec![None; GEN_PAGES];
    depths[0] = Some(0);
    let mut queue = std::collections::VecDeque::from([0usize]);
    while let Some(n) = queue.pop_front() {
        let next_depth = depths[n].map(|d| d + 1);
        for target in gen_link_targets(n) {
            if depths[target].is_none() {
                depths[target] = next_depth;
                queue.push_back(target);
            }
        }
    }
    depths
}

/// `maxDepth` the large-site crawl runs with: comfortably above the deepest page, so the
/// depth limit never decides the page count.
const GEN_MAX_DEPTH: usize = 100;

#[test]
fn gen_links_reach_every_page() {
    let depths = gen_link_depths();
    let unreachable: Vec<usize> = (0..GEN_PAGES).filter(|n| depths[*n].is_none()).collect();
    assert!(unreachable.is_empty(), "unreachable: {unreachable:?}");
    let deepest = depths.iter().flatten().max().copied().unwrap_or(0);
    assert!(
        deepest < GEN_MAX_DEPTH,
        "deepest page is at depth {deepest}"
    );
}

/// Wall-time budget for one 2000-page crawl. Generous (debug builds, shared CI runners,
/// parallel test threads): about 40 times the measured time, so it only trips on a
/// roughly 40x slowdown at this size, not on smaller regressions or every O(n^2) step.
/// A tripwire, not a benchmark. See ADR-0021 for the retry design.
const LARGE_SITE_BUDGET: std::time::Duration = std::time::Duration::from_secs(60);
/// Timed attempts before the budget check fails: one slow run on a busy machine is
/// retried, a consistently slow crawler is not.
const LARGE_SITE_ATTEMPTS: usize = 3;
/// Hard ceiling for any single attempt, so a hung crawl fails instead of stalling
/// `cargo test`. 2.5 times the budget: a slow attempt still finishes and gets retried,
/// while all attempts together stay well inside the gate's own timeout.
const LARGE_SITE_HARD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(150);

/// Deterministic checks on a finished large-site crawl, independent of timing.
fn assert_large_site_complete(site: &FixtureServer, out: &CrawlOutput) {
    assert_eq!(out.pages.len(), GEN_PAGES, "page count");
    let expected: std::collections::BTreeSet<String> = (0..GEN_PAGES)
        .map(|n| site.url(&format!("/gen/{n}")))
        .collect();
    let crawled: std::collections::BTreeSet<String> =
        out.pages.iter().map(|p| p.url.clone()).collect();
    assert_eq!(crawled, expected, "crawled URL set");
    let not_ok: Vec<(&str, Option<u16>)> = out
        .pages
        .iter()
        .filter(|p| p.status != Some(200))
        .map(|p| (p.url.as_str(), p.status))
        .collect();
    assert!(not_ok.is_empty(), "pages not answering 200: {not_ok:?}");
    let titles: std::collections::HashSet<Option<&str>> =
        out.pages.iter().map(|p| p.title.as_deref()).collect();
    assert_eq!(titles.len(), GEN_PAGES, "every generated title is unique");

    // One unique image per page plus the shared one, each checked exactly once.
    assert_eq!(out.resources.len(), GEN_PAGES + 1, "image resource count");
    assert!(
        out.resources.iter().all(|r| r.status == Some(200)),
        "every generated image answers 200"
    );
    assert_eq!(out.linked_urls.len(), GEN_PAGES, "linked internal URLs");

    // `out.resources` is keyed by URL, so it can't show a duplicate check; the server's
    // request counts can. Needs `reset_request_counts` right before the crawl.
    assert_eq!(
        site.request_count_with_prefix("/gen/img/shared.png"),
        1,
        "the image on every page is requested once"
    );
    assert_eq!(
        site.request_count_with_prefix("/gen/img/"),
        GEN_PAGES + 1,
        "image requests, any method"
    );
    assert_eq!(
        site.request_count("GET", "/gen/0"),
        1,
        "the start page is requested once"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn large_site_crawl_completes_within_budget() {
    let site = FixtureServer::start().await;
    let config = json!({
        "maxPages": GEN_PAGES,
        "maxDepth": GEN_MAX_DEPTH,
        "concurrency": 16,
        "checkImages": true,
        "timeoutSecs": 30,
    });

    // Warm-up: a short untimed crawl pays one-off costs (lazy statics, HTTP client
    // setup, first-touch allocations) outside the measured runs.
    let warm_up = crawl(
        &site.url("/gen/0"),
        json!({ "maxPages": 50, "concurrency": 16 }),
    )
    .await;
    assert_eq!(warm_up.pages.len(), 50, "warm-up page count");

    let mut timings = Vec::new();
    for attempt in 1..=LARGE_SITE_ATTEMPTS {
        site.reset_request_counts();
        let started = std::time::Instant::now();
        let out = tokio::time::timeout(
            LARGE_SITE_HARD_TIMEOUT,
            crawl(&site.url("/gen/0"), config.clone()),
        )
        .await
        .unwrap_or_else(|_| {
            panic!("large-site crawl attempt {attempt} hung past {LARGE_SITE_HARD_TIMEOUT:?}")
        });
        let elapsed = started.elapsed();
        // Correctness is checked on every attempt: a retry never hides a wrong result.
        assert_large_site_complete(&site, &out);

        let pages_per_sec = GEN_PAGES as f64 / elapsed.as_secs_f64();
        eprintln!(
            "large_site: attempt {attempt}: {GEN_PAGES} pages + {} images in {:.2}s ({pages_per_sec:.1} pages/s)",
            out.resources.len(),
            elapsed.as_secs_f64()
        );
        timings.push(elapsed);
        if elapsed <= LARGE_SITE_BUDGET {
            return;
        }
    }
    panic!(
        "large-site crawl exceeded the {LARGE_SITE_BUDGET:?} budget on all {LARGE_SITE_ATTEMPTS} attempts: {timings:?}"
    );
}
