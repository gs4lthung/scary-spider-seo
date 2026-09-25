//! End-to-end crawl tests against the static fixture site in `tests/fixtures/site/`
//! (see its README for which page triggers which signal). A tiny HTTP server runs
//! in-process on 127.0.0.1, and `run_crawl` runs on Tauri's mock runtime, so these
//! tests need no network, no browser and no window.

use super::crawl::{run_crawl, CrawlState};
use super::types::{CrawlConfig, PageResult, ResourceResult};
use dashmap::DashMap;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

struct FixtureServer {
    origin: String,
}

impl FixtureServer {
    async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind fixture server");
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/site");
        let served_origin = origin.clone();
        tokio::spawn(async move {
            loop {
                let Ok((mut stream, _)) = listener.accept().await else {
                    return;
                };
                let root = root.clone();
                let origin = served_origin.clone();
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 8192];
                    let mut len = 0;
                    while !buf[..len].windows(4).any(|w| w == b"\r\n\r\n") && len < buf.len() {
                        match stream.read(&mut buf[len..]).await {
                            Ok(0) | Err(_) => return,
                            Ok(n) => len += n,
                        }
                    }
                    let request = String::from_utf8_lossy(&buf[..len]);
                    let mut parts = request.split_whitespace();
                    let method = parts.next().unwrap_or("GET").to_string();
                    let path = parts.next().unwrap_or("/").split('?').next().unwrap_or("/");
                    let response = respond(&root, &origin, &method, path);
                    let _ = stream.write_all(&response).await;
                    let _ = stream.shutdown().await;
                });
            }
        });
        Self { origin }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.origin, path)
    }
}

fn http_response(status: &str, headers: &[(&str, &str)], body: &[u8], head_only: bool) -> Vec<u8> {
    let mut out = format!(
        "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n",
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

/// Routes that can't be static files (redirects, images) are handled here; everything
/// else is read from the fixture directory, with `{{ORIGIN}}` substituted.
fn respond(root: &std::path::Path, origin: &str, method: &str, path: &str) -> Vec<u8> {
    let head = method == "HEAD";
    let redirect =
        |to: &str| http_response("301 Moved Permanently", &[("Location", to)], b"", head);
    match path {
        "/old-page" => return redirect("/new-page.html"),
        "/loop-a" => return redirect("/loop-b"),
        "/loop-b" => return redirect("/loop-a"),
        "/img/ok.png" | "/img/decorative.png" => {
            return http_response("200 OK", &[("Content-Type", "image/png")], b"\x89PNG", head)
        }
        _ => {}
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
            http_response(
                "200 OK",
                &[("Content-Type", content_type)],
                body.as_bytes(),
                head,
            )
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
    let pages = Arc::new(Mutex::new(Vec::new()));
    let resources = Arc::new(DashMap::new());
    let state = CrawlState {
        cancel: Arc::new(AtomicBool::new(false)),
        paused: Arc::new(AtomicBool::new(false)),
        pages: pages.clone(),
        resources: resources.clone(),
        resources_checked: Arc::new(AtomicUsize::new(0)),
        resume_slot: Arc::new(Mutex::new(None)),
    };
    run_crawl(app.handle().clone(), config, state, None).await;

    let pages = pages.lock().unwrap().clone();
    let resources = resources.iter().map(|e| e.value().clone()).collect();
    CrawlOutput { pages, resources }
}

#[tokio::test(flavor = "multi_thread")]
async fn crawls_every_linked_page_exactly_once() {
    let site = FixtureServer::start().await;
    let out = crawl(&site.url("/"), json!({})).await;

    let expected: Vec<String> = [
        "/",
        "/URL_Page.html?ref=nav",
        "/a//b.html",
        "/bad-jsonld.html",
        "/canonical-to-noindex.html",
        "/canonical-to-redirect.html",
        "/canonicalised.html",
        "/dup-a.html",
        "/dup-b.html",
        "/gone.html",
        "/h1-and-images.html",
        "/loop-a",
        "/missing-title.html",
        "/nofollow.html",
        "/noindex.html",
        "/old-page",
        "/private/secret.html",
        "/title-equals-h1.html",
    ]
    .iter()
    .map(|p| site.url(p))
    .collect();
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
    assert_eq!(home.internal_link_count, 17);
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
    assert_eq!(images.image_count, 3);
    // alt="" marks a decorative image and is deliberately not counted as missing.
    assert_eq!(images.missing_alt_count, 1);

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
}
