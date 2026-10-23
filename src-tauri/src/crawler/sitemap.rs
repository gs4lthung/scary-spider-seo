use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::Client;
use url::Url;

const MAX_CHILD_SITEMAPS: usize = 10;

/// Every `<loc>` URL in a sitemap or sitemap index. A `<loc>` arrives in pieces (text,
/// entity references such as `&amp;`, CDATA), so its text is collected whole before it
/// is parsed; a namespace prefix (`<sm:loc>`) is ignored.
fn parse_locs(xml: &str) -> Vec<Url> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut urls = Vec::new();
    let mut loc: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.local_name().as_ref() == b"loc" => loc = Some(String::new()),
            Ok(Event::End(e)) if e.local_name().as_ref() == b"loc" => {
                if let Some(Ok(u)) = loc.take().map(|text| Url::parse(text.trim())) {
                    urls.push(u);
                }
            }
            Ok(Event::Text(t)) => {
                if let (Some(text), Ok(part)) = (loc.as_mut(), t.decode()) {
                    text.push_str(&part);
                }
            }
            Ok(Event::CData(c)) => {
                if let (Some(text), Ok(part)) = (loc.as_mut(), c.decode()) {
                    text.push_str(&part);
                }
            }
            Ok(Event::GeneralRef(r)) => {
                if let Some(text) = loc.as_mut() {
                    if let Ok(Some(ch)) = r.resolve_char_ref() {
                        text.push(ch);
                    } else if let Some(entity) = r
                        .decode()
                        .ok()
                        .and_then(|name| quick_xml::escape::resolve_predefined_entity(&name))
                    {
                        text.push_str(entity);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    urls
}

/// Most sitemaps declared in robots.txt that one crawl reads.
const MAX_ROOT_SITEMAPS: usize = 10;

/// Sitemap URLs a robots.txt declares with `Sitemap:` lines (they apply to the whole
/// file, not to a user-agent group), resolved against the site's origin.
pub fn robots_sitemaps(robots_txt: &str, origin: &Url) -> Vec<Url> {
    robots_txt
        .lines()
        .filter_map(|line| {
            let line = line.split('#').next().unwrap_or("");
            let (key, value) = line.split_once(':')?;
            key.trim()
                .eq_ignore_ascii_case("sitemap")
                .then(|| origin.join(value.trim()).ok())
                .flatten()
        })
        .filter(|u| matches!(u.scheme(), "http" | "https"))
        .collect()
}

async fn fetch_text(client: &Client, url: Url) -> Option<String> {
    match client.get(url).send().await {
        Ok(resp) if resp.status().is_success() => resp.text().await.ok(),
        _ => None,
    }
}

/// Returns every page URL in the site's sitemaps: the ones robots.txt declares, or
/// `/sitemap.xml` when it declares none. Follows one level of sitemap-index nesting.
pub async fn fetch_sitemap_urls(client: &Client, origin: &Url) -> Vec<Url> {
    let mut roots = match origin.join("/robots.txt") {
        Ok(robots_url) => fetch_text(client, robots_url)
            .await
            .map(|body| robots_sitemaps(&body, origin))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    roots.dedup();
    if roots.is_empty() {
        roots.extend(origin.join("/sitemap.xml").ok());
    }

    let mut collected = Vec::new();
    for root in roots.into_iter().take(MAX_ROOT_SITEMAPS) {
        let Some(body) = fetch_text(client, root).await else {
            continue;
        };
        let locs = parse_locs(&body);
        if body.contains("<sitemapindex") {
            for child in locs.into_iter().take(MAX_CHILD_SITEMAPS) {
                if let Some(text) = fetch_text(client, child).await {
                    collected.extend(parse_locs(&text));
                }
            }
        } else {
            collected.extend(locs);
        }
    }
    collected
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn robots_txt_sitemap_lines_are_read() {
        let origin = Url::parse("https://x.com/").unwrap();
        let robots = "User-agent: *
Disallow: /a
Sitemap: https://x.com/s1.xml
sitemap: /s2.xml # relative
Sitemapper: no
";
        let urls: Vec<String> = robots_sitemaps(robots, &origin)
            .iter()
            .map(|u| u.to_string())
            .collect();
        assert_eq!(urls, vec!["https://x.com/s1.xml", "https://x.com/s2.xml"]);
    }

    #[test]
    fn locs_with_entities_cdata_and_prefixes_are_read_whole() {
        let xml = r#"<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://x.com/p?a=1&amp;b=2</loc></url>
  <url><loc><![CDATA[https://x.com/cdata]]></loc></url>
  <sm:url><sm:loc>https://x.com/prefixed</sm:loc></sm:url>
  <url><loc>
    https://x.com/padded
  </loc></url>
</urlset>"#;
        let urls: Vec<String> = parse_locs(xml).iter().map(|u| u.to_string()).collect();
        assert_eq!(
            urls,
            vec![
                "https://x.com/p?a=1&b=2",
                "https://x.com/cdata",
                "https://x.com/prefixed",
                "https://x.com/padded",
            ]
        );
    }

    fn locs(xml: &str) -> Vec<String> {
        parse_locs(xml).iter().map(|u| u.to_string()).collect()
    }

    #[test]
    fn parses_every_loc_in_a_urlset() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2024-01-01</lastmod></url>
  <url><loc> https://example.com/about </loc></url>
</urlset>"#;
        assert_eq!(
            locs(xml),
            vec!["https://example.com/", "https://example.com/about"]
        );
    }

    #[test]
    fn skips_locs_that_are_not_absolute_urls() {
        let xml = "<urlset><url><loc>/relative</loc></url><url><loc>https://example.com/ok</loc></url></urlset>";
        assert_eq!(locs(xml), vec!["https://example.com/ok"]);
    }

    #[test]
    fn reads_child_sitemaps_from_an_index() {
        let xml =
            "<sitemapindex><sitemap><loc>https://example.com/a.xml</loc></sitemap></sitemapindex>";
        assert_eq!(locs(xml), vec!["https://example.com/a.xml"]);
    }

    #[test]
    fn ignores_text_outside_loc_and_malformed_input() {
        assert!(
            locs("<urlset><url><lastmod>https://example.com/</lastmod></url></urlset>").is_empty()
        );
        assert!(locs("not xml at all").is_empty());
    }
}
