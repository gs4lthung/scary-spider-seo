//! User-defined custom search rules (Screaming Frog's Custom Search). Each rule is a
//! literal text or a regular expression searched in a page's raw HTML or its visible
//! body text; the crawler records the number of matches per rule per page as a raw
//! signal. Whether a page "contains" or "does not contain" a rule is decided by the
//! frontend from that count.
//!
//! Also holds the custom extraction rules (Screaming Frog's Custom Extraction): a CSS
//! selector per rule, and the text, one attribute or the inner HTML of every element
//! it matches, recorded per rule per page.

use super::types::{CustomSearchRule, CustomSearchScope, ExtractionMode, ExtractionRule};
use regex::{Regex, RegexBuilder};
use scraper::{Html, Selector};
use std::collections::BTreeMap;

/// Most custom search rules one crawl accepts.
pub const MAX_CUSTOM_SEARCHES: usize = 10;

/// Upper bound on the compiled size of a single rule's pattern, the same limit
/// `scope.rs` puts on URL patterns, so a hostile pattern cannot exhaust memory.
const PATTERN_SIZE_LIMIT: usize = 1 << 20;

#[derive(Debug, Clone)]
struct CompiledRule {
    id: String,
    scope: CustomSearchScope,
    regex: Regex,
}

/// The crawl's custom search rules, compiled once per crawl.
#[derive(Debug, Clone, Default)]
pub struct CustomSearch {
    rules: Vec<CompiledRule>,
}

/// How a rule is named in an error: its name, or its 1-based position when unnamed.
fn rule_label(rule: &CustomSearchRule, index: usize) -> String {
    let name = rule.name.trim();
    if name.is_empty() {
        format!("custom search {}", index + 1)
    } else {
        format!("custom search \"{name}\"")
    }
}

impl CustomSearch {
    /// Compiles every rule. Rules with a blank pattern are skipped (they would match
    /// nothing useful). Plain text rules are matched case-insensitively as literals;
    /// regex rules are compiled as written (use `(?i)` for case-insensitivity). Errors
    /// name the offending rule.
    pub fn new(rules: &[CustomSearchRule]) -> Result<CustomSearch, String> {
        if rules.len() > MAX_CUSTOM_SEARCHES {
            return Err(format!(
                "At most {MAX_CUSTOM_SEARCHES} custom searches are allowed; {} were given.",
                rules.len()
            ));
        }
        let mut compiled = Vec::new();
        for (index, rule) in rules.iter().enumerate() {
            if rule.pattern.trim().is_empty() {
                continue;
            }
            if rule.id.trim().is_empty() {
                return Err(format!("The {} has no id.", rule_label(rule, index)));
            }
            let source = if rule.is_regex {
                rule.pattern.clone()
            } else {
                regex::escape(&rule.pattern)
            };
            let regex = RegexBuilder::new(&source)
                .case_insensitive(!rule.is_regex)
                .size_limit(PATTERN_SIZE_LIMIT)
                .build()
                .map_err(|e| format!("Invalid {}: {e}", rule_label(rule, index)))?;
            compiled.push(CompiledRule {
                id: rule.id.clone(),
                scope: rule.scope,
                regex,
            });
        }
        Ok(CustomSearch { rules: compiled })
    }

    /// Number of non-overlapping matches of every rule, keyed by rule id: `html` is the
    /// raw response body, `text` the visible body text (scripts, styles and markup
    /// already stripped by `parse_page`). Every rule gets an entry, 0 included, so the
    /// frontend can tell "searched and not found" from "not searched".
    pub fn count_matches(&self, html: &str, text: &str) -> BTreeMap<String, u32> {
        self.rules
            .iter()
            .map(|rule| {
                let haystack = match rule.scope {
                    CustomSearchScope::Html => html,
                    CustomSearchScope::Text => text,
                };
                let count = rule.regex.find_iter(haystack).count();
                (rule.id.clone(), u32::try_from(count).unwrap_or(u32::MAX))
            })
            .collect()
    }
}

/// Most custom extraction rules one crawl accepts.
pub const MAX_EXTRACTIONS: usize = 10;
/// Most values one extraction rule records per page (the first matches in document order).
pub const MAX_EXTRACTED_VALUES: usize = 10;
/// Longest extracted value, in characters; longer values are cut on a character boundary.
pub const MAX_EXTRACTED_CHARS: usize = 500;

#[derive(Debug, Clone)]
struct CompiledExtraction {
    id: String,
    selector: Selector,
    mode: ExtractionMode,
    attr: String,
}

/// The crawl's custom extraction rules, with their selectors parsed once per crawl.
#[derive(Debug, Clone, Default)]
pub struct Extraction {
    rules: Vec<CompiledExtraction>,
}

/// How an extraction rule is named in an error: its name, or its 1-based position.
fn extraction_label(rule: &ExtractionRule, index: usize) -> String {
    let name = rule.name.trim();
    if name.is_empty() {
        format!("extraction {}", index + 1)
    } else {
        format!("extraction \"{name}\"")
    }
}

/// Collapses every run of whitespace to one space and trims the ends.
fn collapse_whitespace(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Cuts `value` to `MAX_EXTRACTED_CHARS` characters (never inside a character).
fn cap_value(mut value: String) -> String {
    if let Some((byte_index, _)) = value.char_indices().nth(MAX_EXTRACTED_CHARS) {
        value.truncate(byte_index);
    }
    value
}

impl Extraction {
    /// Parses every rule's selector. Rules with a blank selector are skipped. An attribute
    /// rule needs an attribute name. Errors name the offending rule.
    pub fn new(rules: &[ExtractionRule]) -> Result<Extraction, String> {
        if rules.len() > MAX_EXTRACTIONS {
            return Err(format!(
                "At most {MAX_EXTRACTIONS} extractions are allowed; {} were given.",
                rules.len()
            ));
        }
        let mut compiled = Vec::new();
        for (index, rule) in rules.iter().enumerate() {
            let source = rule.selector.trim();
            if source.is_empty() {
                continue;
            }
            if rule.id.trim().is_empty() {
                return Err(format!("The {} has no id.", extraction_label(rule, index)));
            }
            let selector = Selector::parse(source).map_err(|e| {
                format!(
                    "Invalid CSS selector in {}: {e}",
                    extraction_label(rule, index)
                )
            })?;
            let attr = rule.attr.as_deref().unwrap_or("").trim().to_string();
            if rule.mode == ExtractionMode::Attr && attr.is_empty() {
                return Err(format!(
                    "The {} extracts an attribute but names none.",
                    extraction_label(rule, index)
                ));
            }
            compiled.push(CompiledExtraction {
                id: rule.id.clone(),
                selector,
                mode: rule.mode,
                attr,
            });
        }
        Ok(Extraction { rules: compiled })
    }

    /// Values of every rule on `document`, keyed by rule id: for each matched element in
    /// document order, its whitespace-collapsed text, the trimmed attribute value (elements
    /// without the attribute are skipped) or its trimmed inner HTML. Empty values are
    /// skipped, at most `MAX_EXTRACTED_VALUES` are kept and each is capped at
    /// `MAX_EXTRACTED_CHARS`. Every rule gets an entry, an empty list included, so the
    /// frontend can tell "nothing matched" from "not extracted".
    pub fn extract(&self, document: &Html) -> BTreeMap<String, Vec<String>> {
        self.rules
            .iter()
            .map(|rule| {
                let values = document
                    .select(&rule.selector)
                    .filter_map(|element| match rule.mode {
                        ExtractionMode::Text => {
                            Some(collapse_whitespace(&element.text().collect::<String>()))
                        }
                        ExtractionMode::Attr => element
                            .value()
                            .attr(&rule.attr)
                            .map(|v| v.trim().to_string()),
                        ExtractionMode::InnerHtml => Some(element.inner_html().trim().to_string()),
                    })
                    .filter(|v| !v.is_empty())
                    .take(MAX_EXTRACTED_VALUES)
                    .map(cap_value)
                    .collect();
                (rule.id.clone(), values)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crawler::parse::parse_page;
    use url::Url;

    fn rule(id: &str, pattern: &str, is_regex: bool, scope: CustomSearchScope) -> CustomSearchRule {
        CustomSearchRule {
            id: id.to_string(),
            name: format!("Rule {id}"),
            pattern: pattern.to_string(),
            is_regex,
            scope,
        }
    }

    #[test]
    fn counts_literal_matches_case_insensitively() {
        let search = CustomSearch::new(&[
            rule("a", "Price", false, CustomSearchScope::Html),
            // Regex metacharacters in a plain text rule are literal.
            rule("b", "a.b", false, CustomSearchScope::Html),
        ])
        .unwrap();
        let counts = search.count_matches("price PRICE Price priced axb a.b", "");
        assert_eq!(counts["a"], 4);
        assert_eq!(counts["b"], 1);
    }

    #[test]
    fn regex_rules_match() {
        let search = CustomSearch::new(&[
            rule("sku", r"SKU-\d{3}", true, CustomSearchScope::Html),
            rule("case", "sku", true, CustomSearchScope::Html),
            rule("ci", "(?i)sku", true, CustomSearchScope::Html),
        ])
        .unwrap();
        let counts = search.count_matches("SKU-123 SKU-9 sku-456 SKU-789", "");
        assert_eq!(counts["sku"], 2);
        // Regex rules are case-sensitive unless the pattern says otherwise.
        assert_eq!(counts["case"], 1);
        assert_eq!(counts["ci"], 4);
    }

    #[test]
    fn text_scope_ignores_markup_and_scripts() {
        let html = r#"<html><head><title>T</title>
            <script>var tracking = "analytics";</script>
            <style>.analytics { color: red }</style></head>
            <body><div class="analytics"><p>We use analytics.</p></div>
            <script>trackAnalytics();</script></body></html>"#;
        let parsed = parse_page(html, &Url::parse("https://example.com/").unwrap());
        let search = CustomSearch::new(&[
            rule("text", "analytics", false, CustomSearchScope::Text),
            rule("html", "analytics", false, CustomSearchScope::Html),
        ])
        .unwrap();
        let counts = search.count_matches(html, &parsed.body_text);
        assert_eq!(counts["text"], 1);
        assert_eq!(counts["html"], 5);
    }

    #[test]
    fn every_rule_gets_a_count_and_blank_patterns_are_skipped() {
        let search = CustomSearch::new(&[
            rule("a", "missing", false, CustomSearchScope::Html),
            rule("blank", "  ", false, CustomSearchScope::Html),
        ])
        .unwrap();
        let counts = search.count_matches("<p>nothing here</p>", "nothing here");
        assert_eq!(counts.get("a"), Some(&0));
        assert!(!counts.contains_key("blank"));
        assert!(CustomSearch::new(&[])
            .unwrap()
            .count_matches("x", "x")
            .is_empty());
    }

    #[test]
    fn invalid_rules_are_rejected_with_their_name() {
        let err = CustomSearch::new(&[rule("x", "(unclosed", true, CustomSearchScope::Html)])
            .unwrap_err();
        assert!(
            err.starts_with("Invalid custom search \"Rule x\": "),
            "{err}"
        );
        let mut unnamed = rule("y", "a{1000}{1000}{1000}", true, CustomSearchScope::Text);
        unnamed.name = String::new();
        let err = CustomSearch::new(&[rule("ok", "fine", false, CustomSearchScope::Html), unnamed])
            .unwrap_err();
        assert!(err.starts_with("Invalid custom search 2: "), "{err}");
        // The same text as a literal is fine.
        assert!(
            CustomSearch::new(&[rule("z", "(unclosed", false, CustomSearchScope::Html)]).is_ok()
        );
    }

    #[test]
    fn too_many_rules_are_rejected() {
        let rules: Vec<_> = (0..=MAX_CUSTOM_SEARCHES)
            .map(|i| rule(&i.to_string(), "x", false, CustomSearchScope::Html))
            .collect();
        let err = CustomSearch::new(&rules).unwrap_err();
        assert!(err.contains("At most 10"), "{err}");
        assert!(CustomSearch::new(&rules[..MAX_CUSTOM_SEARCHES]).is_ok());
    }

    fn extraction(id: &str, name: &str, selector: &str, mode: ExtractionMode) -> ExtractionRule {
        ExtractionRule {
            id: id.to_string(),
            name: name.to_string(),
            selector: selector.to_string(),
            mode,
            attr: None,
        }
    }

    #[test]
    fn invalid_selector_is_rejected_with_rule_name() {
        let err =
            Extraction::new(&[extraction("p", "Price", "div[", ExtractionMode::Text)]).unwrap_err();
        assert!(
            err.starts_with("Invalid CSS selector in extraction \"Price\": "),
            "{err}"
        );
        // An unnamed rule is named by its position.
        let err = Extraction::new(&[
            extraction("a", "", ".ok", ExtractionMode::Text),
            extraction("b", " ", "::::", ExtractionMode::InnerHtml),
        ])
        .unwrap_err();
        assert!(
            err.starts_with("Invalid CSS selector in extraction 2: "),
            "{err}"
        );
        // An attribute rule without an attribute name is rejected too.
        let err =
            Extraction::new(&[extraction("m", "Image", "meta", ExtractionMode::Attr)]).unwrap_err();
        assert!(err.contains("\"Image\""), "{err}");
        // Blank selectors are skipped, not rejected.
        let ok = Extraction::new(&[extraction("blank", "", "  ", ExtractionMode::Text)]).unwrap();
        assert!(ok.extract(&Html::parse_document("<p>x</p>")).is_empty());
    }

    #[test]
    fn too_many_extractions_are_rejected() {
        let rules: Vec<_> = (0..=MAX_EXTRACTIONS)
            .map(|i| extraction(&i.to_string(), "", "p", ExtractionMode::Text))
            .collect();
        let err = Extraction::new(&rules).unwrap_err();
        assert!(err.contains("At most 10"), "{err}");
        assert!(Extraction::new(&rules[..MAX_EXTRACTIONS]).is_ok());
    }

    #[test]
    fn cap_value_cuts_on_a_character_boundary() {
        let long = "\u{e9}".repeat(MAX_EXTRACTED_CHARS + 5);
        let capped = cap_value(long);
        assert_eq!(capped.chars().count(), MAX_EXTRACTED_CHARS);
        assert_eq!(cap_value("abc".to_string()), "abc");
    }
}
