use crate::crawler::types::{
    CustomSearchRule, ExtractionRule, PageResult, ResourceResult, ResourceType,
};
use std::collections::{BTreeMap, HashSet};
use std::fs::File;

/// Ids with an entry on at least one page, in the order they first appear (each page's ids
/// sorted shorter first, so `ex2` comes before `ex10`).
fn ids_in_page_order<'a, V: 'a>(
    pages: &'a [PageResult],
    map: impl Fn(&'a PageResult) -> &'a BTreeMap<String, V>,
) -> Vec<&'a str> {
    let mut seen = HashSet::new();
    let mut order = Vec::new();
    for p in pages {
        let mut page_ids: Vec<&String> = map(p).keys().collect();
        page_ids.sort_by(|a, b| a.len().cmp(&b.len()).then_with(|| a.cmp(b)));
        for id in page_ids {
            if seen.insert(id.as_str()) {
                order.push(id.as_str());
            }
        }
    }
    order
}

/// The pages CSV's custom search columns: every rule id with a count on at least one page,
/// as `(id, header)`. Ids of `rules` come first in rule order, then any other id in the order
/// ids first appear (each page's ids sorted shorter first). A column is headed by the rule's
/// name, else its pattern, else (a rule not in `rules`) the bare id.
fn custom_search_columns(
    pages: &[PageResult],
    rules: &[CustomSearchRule],
) -> Vec<(String, String)> {
    let page_order = ids_in_page_order(pages, |p| &p.custom_search_counts);
    let seen_on_pages: HashSet<&str> = page_order.iter().copied().collect();
    let mut columns = Vec::new();
    let mut emitted = HashSet::new();
    for rule in rules {
        if seen_on_pages.contains(rule.id.as_str()) && emitted.insert(rule.id.as_str()) {
            let label = [rule.name.trim(), rule.pattern.trim()]
                .into_iter()
                .find(|s| !s.is_empty())
                .unwrap_or(rule.id.as_str());
            columns.push((rule.id.clone(), format!("Custom Search: {label}")));
        }
    }
    for id in page_order {
        if emitted.insert(id) {
            columns.push((id.to_string(), format!("Custom Search: {id}")));
        }
    }
    columns
}

/// The pages CSV's custom extraction columns: every rule id with an entry on at least one
/// page, as `(id, header)`. Ids of `rules` come first in rule order, then any other id. A
/// column is headed `Extraction: ` and the rule's name, else its selector, else (a rule not
/// in `rules`) the bare id; a header already used gets ` (2)`, ` (3)`... appended.
fn extraction_columns(pages: &[PageResult], rules: &[ExtractionRule]) -> Vec<(String, String)> {
    let page_order = ids_in_page_order(pages, |p| &p.extracted);
    let on_pages: HashSet<&str> = page_order.iter().copied().collect();
    let mut labelled: Vec<(&str, &str)> = Vec::new();
    let mut emitted = HashSet::new();
    for rule in rules {
        if on_pages.contains(rule.id.as_str()) && emitted.insert(rule.id.as_str()) {
            let label = [rule.name.trim(), rule.selector.trim()]
                .into_iter()
                .find(|s| !s.is_empty())
                .unwrap_or(rule.id.as_str());
            labelled.push((rule.id.as_str(), label));
        }
    }
    for id in page_order {
        if emitted.insert(id) {
            labelled.push((id, id));
        }
    }
    let mut used: HashSet<String> = HashSet::new();
    labelled
        .into_iter()
        .map(|(id, label)| {
            let base = format!("Extraction: {label}");
            let mut header = base.clone();
            let mut n = 1;
            while used.contains(&header) {
                n += 1;
                header = format!("{base} ({n})");
            }
            used.insert(header.clone());
            (id.to_string(), header)
        })
        .collect()
}

pub fn export_pages_csv(
    pages: &[PageResult],
    custom_searches: &[CustomSearchRule],
    extractions: &[ExtractionRule],
    path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::create(path)?;
    let mut wtr = csv::Writer::from_writer(file);
    let custom_columns = custom_search_columns(pages, custom_searches);
    let extraction_columns = extraction_columns(pages, extractions);

    let fixed_headers = [
        "URL",
        "Status",
        "Status Text",
        "Indexability",
        "Depth",
        "Title",
        "Title Length",
        "Meta Description",
        "Meta Description Length",
        "H1",
        "H1 Count",
        "H1 Values",
        "H2 Values",
        "H2 Count",
        "Heading Levels",
        "Title Count",
        "Meta Description Count",
        "Meta Refresh",
        "Pagination Next",
        "Pagination Prev",
        "Word Count",
        "Canonical",
        "Meta Robots",
        "Redirect URL",
        "Content Type",
        "Response Time (ms)",
        "Internal Links",
        "External Links",
        "Images",
        "Size (bytes)",
        "Minified",
        "Minify Savings (%)",
        "JS Rendered",
        "HSTS",
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Mixed Content",
        "Insecure Links",
        "Missing Alt Images",
        "Images Missing Dimensions",
        "Lang",
        "Hreflang Values",
        "Hreflang Links",
        "Internal Nofollow Links",
        "Text/HTML Ratio (%)",
        "Content Hash",
        "Content Simhash",
        "X-Robots-Tag",
        "Viewport",
        "Has Open Graph",
        "Has Twitter Card",
        "Canonical Count",
        "Discovered Via Sitemap",
        "Redirect Chain",
        "Structured Data Types",
        "Structured Data Errors",
        "Accessibility Violations",
        "Mobile Usability Violations",
        "Error",
    ];
    wtr.write_record(
        fixed_headers
            .iter()
            .map(|h| h.to_string())
            .chain(custom_columns.iter().map(|(_, header)| header.clone()))
            .chain(extraction_columns.iter().map(|(_, header)| header.clone())),
    )?;

    for p in pages {
        let fixed = [
            p.url.clone(),
            p.status.map(|s| s.to_string()).unwrap_or_default(),
            p.status_text.clone(),
            p.indexability.clone(),
            p.depth.to_string(),
            p.title.clone().unwrap_or_default(),
            p.title_length.to_string(),
            p.meta_description.clone().unwrap_or_default(),
            p.meta_description_length.to_string(),
            p.h1.clone().unwrap_or_default(),
            p.h1_count.to_string(),
            p.h1_values.join(" | "),
            p.h2_values.join(" | "),
            p.h2_count.to_string(),
            p.heading_levels
                .iter()
                .map(|l| format!("H{l}"))
                .collect::<Vec<_>>()
                .join(" > "),
            p.title_count.to_string(),
            p.meta_description_count.to_string(),
            p.meta_refresh.clone().unwrap_or_default(),
            p.pagination_next.clone().unwrap_or_default(),
            p.pagination_prev.clone().unwrap_or_default(),
            p.word_count.to_string(),
            p.canonical.clone().unwrap_or_default(),
            p.meta_robots.clone().unwrap_or_default(),
            p.redirect_url.clone().unwrap_or_default(),
            p.content_type.clone().unwrap_or_default(),
            p.response_time_ms.to_string(),
            p.internal_link_count.to_string(),
            p.external_link_count.to_string(),
            p.image_count.to_string(),
            p.html_size_bytes.to_string(),
            p.is_minified.to_string(),
            format!("{:.0}", p.minify_savings_pct),
            p.rendered.to_string(),
            p.hsts.to_string(),
            p.content_security_policy.clone().unwrap_or_default(),
            p.x_frame_options.clone().unwrap_or_default(),
            p.x_content_type_options.clone().unwrap_or_default(),
            p.referrer_policy.clone().unwrap_or_default(),
            p.mixed_content_count.to_string(),
            p.insecure_link_count.to_string(),
            p.missing_alt_count.to_string(),
            p.images_missing_dimensions.to_string(),
            p.lang.clone().unwrap_or_default(),
            p.hreflang_values.join(", "),
            p.hreflang_links
                .iter()
                .map(|l| format!("{} {}", l.lang, l.href))
                .collect::<Vec<_>>()
                .join(", "),
            p.internal_nofollow_count.to_string(),
            format!("{:.1}", p.text_ratio_pct),
            p.content_hash.clone(),
            p.content_simhash.clone(),
            p.x_robots_tag.clone().unwrap_or_default(),
            p.viewport.clone().unwrap_or_default(),
            p.has_open_graph.to_string(),
            p.has_twitter_card.to_string(),
            p.canonical_count.to_string(),
            p.discovered_via_sitemap.to_string(),
            p.redirect_chain.join(" -> "),
            p.structured_data_types.join(", "),
            p.structured_data_errors.join("; "),
            p.accessibility_violations.len().to_string(),
            p.mobile_usability_violations.len().to_string(),
            p.error.clone().unwrap_or_default(),
        ];
        // Blank (not 0) for a page the rule never ran on, e.g. a non-HTML URL.
        let custom = custom_columns.iter().map(|(id, _)| {
            p.custom_search_counts
                .get(id)
                .map(|n| n.to_string())
                .unwrap_or_default()
        });
        // Values joined with " | "; blank where nothing matched or the rule never ran.
        let extracted = extraction_columns.iter().map(|(id, _)| {
            p.extracted
                .get(id)
                .map(|values| values.join(" | "))
                .unwrap_or_default()
        });
        wtr.write_record(fixed.into_iter().chain(custom).chain(extracted))?;
    }

    wtr.flush()?;
    Ok(())
}

pub fn export_resources_csv(
    resources: &[ResourceResult],
    path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::create(path)?;
    let mut wtr = csv::Writer::from_writer(file);

    wtr.write_record([
        "URL",
        "Type",
        "Source Page",
        "Status",
        "Status Text",
        "Internal",
        "Alt Text",
        "Insecure",
        "Size (bytes)",
        "Error",
    ])?;

    for r in resources {
        wtr.write_record([
            r.url.clone(),
            match r.resource_type {
                ResourceType::Link => "Link".to_string(),
                ResourceType::Image => "Image".to_string(),
            },
            r.source_page.clone(),
            r.status.map(|s| s.to_string()).unwrap_or_default(),
            r.status_text.clone(),
            r.is_internal.to_string(),
            r.alt_text.clone().unwrap_or_default(),
            r.is_insecure.to_string(),
            r.content_length.map(|n| n.to_string()).unwrap_or_default(),
            r.error.clone().unwrap_or_default(),
        ])?;
    }

    wtr.flush()?;
    Ok(())
}

/// One row per internal link (`PageResult.outlinks`), duplicates included.
pub fn export_links_csv(
    pages: &[PageResult],
    path: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::create(path)?;
    let mut wtr = csv::Writer::from_writer(file);

    wtr.write_record(["Source", "Target", "Anchor", "Nofollow"])?;

    for p in pages {
        for link in &p.outlinks {
            wtr.write_record([
                p.url.as_str(),
                link.url.as_str(),
                link.anchor.as_str(),
                if link.nofollow { "true" } else { "false" },
            ])?;
        }
    }

    wtr.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crawler::types::LinkRef;

    fn link(url: &str, anchor: &str, nofollow: bool) -> LinkRef {
        LinkRef {
            url: url.to_string(),
            anchor: anchor.to_string(),
            nofollow,
            is_image_link: false,
        }
    }

    #[test]
    fn pages_csv_has_one_column_per_custom_search() {
        let counts = |pairs: &[(&str, u32)]| {
            pairs
                .iter()
                .map(|(k, v)| (k.to_string(), *v))
                .collect::<std::collections::BTreeMap<_, _>>()
        };
        let pages = vec![
            PageResult {
                url: "https://example.com/".to_string(),
                custom_search_counts: counts(&[("cs10", 1), ("cs2", 0)]),
                ..Default::default()
            },
            PageResult {
                url: "https://example.com/logo.png".to_string(),
                ..Default::default()
            },
            PageResult {
                url: "https://example.com/b".to_string(),
                custom_search_counts: counts(&[("cs2", 4), ("cs3", 2)]),
                ..Default::default()
            },
        ];
        let path = std::env::temp_dir().join(format!("gseo-pages-cs-{}.csv", std::process::id()));
        let rules = vec![
            CustomSearchRule {
                id: "cs3".to_string(),
                name: "Prices".to_string(),
                pattern: r"\$\d+".to_string(),
                ..Default::default()
            },
            CustomSearchRule {
                id: "cs10".to_string(),
                name: " ".to_string(),
                pattern: "needle".to_string(),
                ..Default::default()
            },
            // Never counted on any page: no column.
            CustomSearchRule {
                id: "cs99".to_string(),
                name: "Unused".to_string(),
                pattern: "x".to_string(),
                ..Default::default()
            },
        ];
        export_pages_csv(&pages, &rules, &[], path.to_str().unwrap()).unwrap();
        let mut rdr = csv::Reader::from_path(&path).unwrap();
        let headers: Vec<String> = rdr.headers().unwrap().iter().map(str::to_string).collect();
        let rows: Vec<Vec<String>> = rdr
            .records()
            .map(|r| r.unwrap().iter().map(str::to_string).collect())
            .collect();
        std::fs::remove_file(&path).ok();
        let tail = |row: &[String]| row[row.len() - 3..].to_vec();
        assert_eq!(
            tail(&headers),
            vec![
                "Custom Search: Prices",
                "Custom Search: needle",
                "Custom Search: cs2"
            ]
        );
        assert_eq!(tail(&rows[0]), vec!["", "1", "0"]);
        assert_eq!(tail(&rows[1]), vec!["", "", ""]);
        assert_eq!(tail(&rows[2]), vec!["2", "", "4"]);
        assert!(rows.iter().all(|r| r.len() == headers.len()));
    }

    #[test]
    fn pages_csv_has_one_column_per_extraction() {
        let values = |pairs: &[(&str, &[&str])]| {
            pairs
                .iter()
                .map(|(k, v)| (k.to_string(), v.iter().map(|s| s.to_string()).collect()))
                .collect::<BTreeMap<String, Vec<String>>>()
        };
        let pages = vec![
            PageResult {
                url: "https://example.com/".to_string(),
                extracted: values(&[("ex1", &["$5", "$7"]), ("ex2", &[]), ("ex3", &["a"])]),
                ..Default::default()
            },
            PageResult {
                url: "https://example.com/logo.png".to_string(),
                ..Default::default()
            },
            PageResult {
                url: "https://example.com/b".to_string(),
                extracted: values(&[("ex1", &["$9"]), ("ex2", &["x"]), ("old", &["y"])]),
                ..Default::default()
            },
        ];
        let rule = |id: &str, name: &str, selector: &str| ExtractionRule {
            id: id.to_string(),
            name: name.to_string(),
            selector: selector.to_string(),
            ..Default::default()
        };
        let rules = vec![
            rule("ex1", "Price", ".price"),
            // Same name as ex1: the header is made unique.
            rule("ex2", "Price", ".sale"),
            // No name: headed by the selector.
            rule("ex3", "", "h1"),
            // Never extracted on any page: no column.
            rule("ex9", "Unused", "p"),
        ];
        let path = std::env::temp_dir().join(format!("gseo-pages-ex-{}.csv", std::process::id()));
        export_pages_csv(&pages, &[], &rules, path.to_str().unwrap()).unwrap();
        let mut rdr = csv::Reader::from_path(&path).unwrap();
        let headers: Vec<String> = rdr.headers().unwrap().iter().map(str::to_string).collect();
        let rows: Vec<Vec<String>> = rdr
            .records()
            .map(|r| r.unwrap().iter().map(str::to_string).collect())
            .collect();
        std::fs::remove_file(&path).ok();
        let tail = |row: &[String]| row[row.len() - 4..].to_vec();
        assert_eq!(
            tail(&headers),
            vec![
                "Extraction: Price",
                "Extraction: Price (2)",
                "Extraction: h1",
                "Extraction: old"
            ]
        );
        assert_eq!(tail(&rows[0]), vec!["$5 | $7", "", "a", ""]);
        assert_eq!(tail(&rows[1]), vec!["", "", "", ""]);
        assert_eq!(tail(&rows[2]), vec!["$9", "x", "", "y"]);
        assert!(rows.iter().all(|r| r.len() == headers.len()));
    }

    #[test]
    fn links_csv_has_one_row_per_link() {
        let pages = vec![
            PageResult {
                url: "https://example.com/".to_string(),
                outlinks: vec![
                    link("https://example.com/a", "Read, \"the\" guide", false),
                    link("https://example.com/a", "Other", true),
                ],
                ..Default::default()
            },
            PageResult {
                url: "https://example.com/a".to_string(),
                ..Default::default()
            },
            PageResult {
                url: "https://example.com/b".to_string(),
                outlinks: vec![link("https://example.com/", "", false)],
                ..Default::default()
            },
        ];
        let path = std::env::temp_dir().join(format!("gseo-links-{}.csv", std::process::id()));
        export_links_csv(&pages, path.to_str().unwrap()).unwrap();
        let mut rdr = csv::Reader::from_path(&path).unwrap();
        assert_eq!(
            rdr.headers().unwrap(),
            vec!["Source", "Target", "Anchor", "Nofollow"]
        );
        let rows: Vec<Vec<String>> = rdr
            .records()
            .map(|r| r.unwrap().iter().map(str::to_string).collect())
            .collect();
        std::fs::remove_file(&path).ok();
        assert_eq!(
            rows,
            vec![
                vec![
                    "https://example.com/",
                    "https://example.com/a",
                    "Read, \"the\" guide",
                    "false"
                ],
                vec![
                    "https://example.com/",
                    "https://example.com/a",
                    "Other",
                    "true"
                ],
                vec!["https://example.com/b", "https://example.com/", "", "false"],
            ]
        );
    }
}
