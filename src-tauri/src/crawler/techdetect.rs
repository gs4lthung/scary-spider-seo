use reqwest::header::HeaderMap;

pub struct HeaderTech {
    pub server: Option<String>,
    pub powered_by: Option<String>,
    pub cdn: Option<String>,
}

pub fn detect_from_headers(headers: &HeaderMap) -> HeaderTech {
    let server = headers
        .get("server")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let powered_by = headers
        .get("x-powered-by")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let server_lower = server.as_deref().unwrap_or("").to_ascii_lowercase();
    let cdn = if headers.contains_key("cf-ray") || server_lower.contains("cloudflare") {
        Some("Cloudflare".to_string())
    } else if headers.contains_key("x-amz-cf-id") {
        Some("Amazon CloudFront".to_string())
    } else if headers
        .get("x-served-by")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_ascii_lowercase().contains("cache"))
        .unwrap_or(false)
    {
        Some("Fastly".to_string())
    } else if headers.contains_key("x-vercel-id") {
        Some("Vercel".to_string())
    } else if headers.contains_key("x-nf-request-id") {
        Some("Netlify".to_string())
    } else if headers.contains_key("x-akamai-request-id") || server_lower.contains("akamaighost") {
        Some("Akamai".to_string())
    } else {
        None
    };

    HeaderTech {
        server,
        powered_by,
        cdn,
    }
}

/// Cheap substring-based fingerprinting of the raw homepage HTML. Not a full
/// Wappalyzer replacement, but catches the most common platforms/libraries
/// without needing a signature database.
pub fn detect_from_html(html: &str) -> (Option<String>, Vec<String>) {
    let lower = html.to_ascii_lowercase();
    let has = |needle: &str| lower.contains(needle);

    let cms = if has("wp-content") || has("wp-includes") {
        Some("WordPress")
    } else if has("/sites/default/files") || has("drupal.settings") {
        Some("Drupal")
    } else if has("joomla!") || has("/media/jui/") {
        Some("Joomla")
    } else if has("cdn.shopify.com") || has("shopify.theme") {
        Some("Shopify")
    } else if has("static.wixstatic.com") || has("wix.com") {
        Some("Wix")
    } else if has("squarespace") {
        Some("Squarespace")
    } else if has("cdn.webflow.com") {
        Some("Webflow")
    } else {
        None
    }
    .map(|s| s.to_string());

    let mut technologies = Vec::new();
    let mut push = |name: &str| technologies.push(name.to_string());

    if has("_next/static") || has("__next_data__") {
        push("Next.js");
    }
    if has("__nuxt__") {
        push("Nuxt.js");
    }
    if has("ng-version") {
        push("Angular");
    }
    if has("data-reactroot") || has("react-dom") {
        push("React");
    }
    if has("data-v-app") || has("vue.js") || has("__vue__") {
        push("Vue.js");
    }
    if has("jquery") {
        push("jQuery");
    }
    if has("bootstrap") {
        push("Bootstrap");
    }
    if has("tailwind") {
        push("Tailwind CSS");
    }
    if has("googletagmanager.com/gtm.js") {
        push("Google Tag Manager");
    }
    if has("google-analytics.com") || has("gtag(") {
        push("Google Analytics");
    }
    if has("cdn.jsdelivr.net") {
        push("jsDelivr CDN");
    }

    (cms, technologies)
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_static(value));
        }
        map
    }

    #[test]
    fn reads_server_and_powered_by() {
        let tech = detect_from_headers(&headers(&[
            ("server", "nginx"),
            ("x-powered-by", "PHP/8.2"),
        ]));
        assert_eq!(tech.server.as_deref(), Some("nginx"));
        assert_eq!(tech.powered_by.as_deref(), Some("PHP/8.2"));
        assert_eq!(tech.cdn, None);
    }

    #[test]
    fn detects_cdns_from_headers() {
        let cases: [(&[(&'static str, &'static str)], &str); 7] = [
            (&[("cf-ray", "abc")], "Cloudflare"),
            (&[("server", "cloudflare")], "Cloudflare"),
            (&[("x-amz-cf-id", "abc")], "Amazon CloudFront"),
            (&[("x-served-by", "cache-fra123")], "Fastly"),
            (&[("x-vercel-id", "abc")], "Vercel"),
            (&[("x-nf-request-id", "abc")], "Netlify"),
            (&[("server", "AkamaiGHost")], "Akamai"),
        ];
        for (pairs, expected) in cases {
            assert_eq!(
                detect_from_headers(&headers(pairs)).cdn.as_deref(),
                Some(expected)
            );
        }
    }

    #[test]
    fn detects_cms_case_insensitively() {
        let (cms, _) = detect_from_html(r#"<link href="/WP-CONTENT/themes/x.css">"#);
        assert_eq!(cms.as_deref(), Some("WordPress"));
        let (cms, _) = detect_from_html(r#"<script src="https://cdn.shopify.com/s.js"></script>"#);
        assert_eq!(cms.as_deref(), Some("Shopify"));
        let (cms, technologies) = detect_from_html("<html><body>plain</body></html>");
        assert_eq!(cms, None);
        assert!(technologies.is_empty());
    }

    #[test]
    fn detects_frontend_technologies() {
        let html = r#"<script src="/_next/static/app.js"></script>
            <script src="https://code.jquery.com/jquery.min.js"></script>
            <script src="https://www.googletagmanager.com/gtm.js?id=X"></script>"#;
        let (_, technologies) = detect_from_html(html);
        assert_eq!(
            technologies,
            vec!["Next.js", "jQuery", "Google Tag Manager"]
        );
    }
}
