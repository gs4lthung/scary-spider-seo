use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::Client;
use url::Url;

const MAX_CHILD_SITEMAPS: usize = 10;

fn parse_locs(xml: &str) -> Vec<Url> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut urls = Vec::new();
    let mut in_loc = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"loc" => in_loc = true,
            Ok(Event::End(e)) if e.name().as_ref() == b"loc" => in_loc = false,
            Ok(Event::Text(t)) if in_loc => {
                if let Ok(text) = t.decode() {
                    if let Ok(u) = Url::parse(text.trim()) {
                        urls.push(u);
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

/// Fetches `/sitemap.xml` for the given origin and returns every page URL it
/// lists. Transparently follows one level of sitemap-index nesting.
pub async fn fetch_sitemap_urls(client: &Client, origin: &Url) -> Vec<Url> {
    let sitemap_url = match origin.join("/sitemap.xml") {
        Ok(u) => u,
        Err(_) => return Vec::new(),
    };

    let body = match client.get(sitemap_url).send().await {
        Ok(resp) if resp.status().is_success() => match resp.text().await {
            Ok(b) => b,
            Err(_) => return Vec::new(),
        },
        _ => return Vec::new(),
    };

    let locs = parse_locs(&body);

    if body.contains("<sitemapindex") {
        let mut collected = Vec::new();
        for child in locs.into_iter().take(MAX_CHILD_SITEMAPS) {
            if let Ok(resp) = client.get(child).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        collected.extend(parse_locs(&text));
                    }
                }
            }
        }
        return collected;
    }

    locs
}

#[cfg(test)]
mod tests {
    use super::*;

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
