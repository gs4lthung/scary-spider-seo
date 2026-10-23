use reqwest::Client;
use url::Url;

/// One `Allow`/`Disallow` rule: its path pattern (with `*` wildcards and an optional `$`
/// end anchor, as in RFC 9309) and whether it allows.
struct Rule {
    pattern: String,
    allow: bool,
}

/// The robots.txt rules that apply to this crawler (RFC 9309): the group(s) naming the
/// crawler's product token, or the `User-agent: *` group(s) when none does.
pub struct RobotsRules {
    rules: Vec<Rule>,
    /// The applicable group's `Crawl-delay`, in milliseconds, if the file specifies one.
    pub crawl_delay_ms: Option<u64>,
}

/// Rules and crawl delay collected for one kind of group while parsing.
#[derive(Default)]
struct GroupRules {
    rules: Vec<Rule>,
    crawl_delay_ms: Option<u64>,
    found: bool,
}

/// The product token robots.txt groups are matched against: the user agent's first word
/// before any `/` version (`ScarySpiderSEO/0.1 (+url)` -> `scaryspiderseo`), lowercased.
pub fn product_token(user_agent: &str) -> String {
    user_agent
        .split(|c: char| c == '/' || c.is_whitespace())
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
}

impl RobotsRules {
    pub fn allow_all() -> Self {
        Self {
            rules: Vec::new(),
            crawl_delay_ms: None,
        }
    }

    pub async fn fetch(client: &Client, origin: &Url, user_agent: &str) -> Self {
        let robots_url = match origin.join("/robots.txt") {
            Ok(u) => u,
            Err(_) => return Self::allow_all(),
        };

        let body = match client.get(robots_url).send().await {
            Ok(resp) if resp.status().is_success() => resp.text().await.unwrap_or_default(),
            _ => return Self::allow_all(),
        };

        Self::parse(&body, &product_token(user_agent))
    }

    /// Parses `body` for the crawler whose product token is `agent` (lowercase). Consecutive
    /// `User-agent` lines share one group; a `User-agent` line after a rule starts a new one.
    /// Every group naming `agent` is merged; without one, every `*` group is.
    fn parse(body: &str, agent: &str) -> Self {
        let mut named = GroupRules::default();
        let mut wildcard = GroupRules::default();
        // Which kinds the current group's user agents name: (named, wildcard).
        let mut current = (false, false);
        let mut in_agent_lines = false;

        for raw_line in body.lines() {
            let line = raw_line.split('#').next().unwrap_or("").trim();
            if line.is_empty() {
                continue;
            }
            let Some((key, value)) = line.split_once(':') else {
                continue;
            };
            let key = key.trim().to_ascii_lowercase();
            let value = value.trim();

            if key == "user-agent" {
                if !in_agent_lines {
                    current = (false, false);
                    in_agent_lines = true;
                }
                let name = value.to_ascii_lowercase();
                if name == "*" {
                    current.1 = true;
                    wildcard.found = true;
                } else if !agent.is_empty() && name == agent {
                    current.0 = true;
                    named.found = true;
                }
                continue;
            }
            in_agent_lines = false;

            let rule = match key.as_str() {
                "disallow" if !value.is_empty() => Some(false),
                "allow" if !value.is_empty() => Some(true),
                _ => None,
            };
            let delay = (key == "crawl-delay")
                .then(|| value.parse::<f64>().ok())
                .flatten()
                .filter(|secs| secs.is_finite() && *secs >= 0.0)
                .map(|secs| (secs * 1000.0) as u64);

            for (applies, group) in [(current.0, &mut named), (current.1, &mut wildcard)] {
                if !applies {
                    continue;
                }
                if let Some(allow) = rule {
                    group.rules.push(Rule {
                        pattern: value.to_string(),
                        allow,
                    });
                }
                if delay.is_some() {
                    group.crawl_delay_ms = delay;
                }
            }
        }

        let group = if named.found { named } else { wildcard };
        Self {
            rules: group.rules,
            crawl_delay_ms: group.crawl_delay_ms,
        }
    }

    /// Whether `url` may be crawled: its path and query are matched against every rule; the
    /// longest matching pattern wins, and an Allow beats a Disallow of equal length.
    pub fn is_url_allowed(&self, url: &Url) -> bool {
        match url.query() {
            Some(query) => self.is_allowed(&format!("{}?{}", url.path(), query)),
            None => self.is_allowed(url.path()),
        }
    }

    /// Like `is_url_allowed`, for a path that already includes any `?query`.
    pub fn is_allowed(&self, path: &str) -> bool {
        let mut best: Option<(usize, bool)> = None;
        for rule in &self.rules {
            if !pattern_matches(&rule.pattern, path) {
                continue;
            }
            let len = rule.pattern.len();
            let better = match best {
                None => true,
                Some((best_len, best_allow)) => {
                    len > best_len || (len == best_len && rule.allow && !best_allow)
                }
            };
            if better {
                best = Some((len, rule.allow));
            }
        }
        best.is_none_or(|(_, allow)| allow)
    }
}

/// Whether a robots.txt path pattern matches the start of `path`: `*` matches any run of
/// characters and a trailing `$` requires the match to reach the end of `path`.
fn pattern_matches(pattern: &str, path: &str) -> bool {
    let (pattern, anchored) = match pattern.strip_suffix('$') {
        Some(p) => (p, true),
        None => (pattern, false),
    };
    let mut parts = pattern.split('*');
    let first = parts.next().unwrap_or("");
    if !path.starts_with(first) {
        return false;
    }
    let mut pos = first.len();
    let rest: Vec<&str> = parts.collect();
    let Some((last, middle)) = rest.split_last() else {
        return !anchored || pos == path.len();
    };
    for part in middle {
        match path[pos..].find(part) {
            Some(i) => pos += i + part.len(),
            None => return false,
        }
    }
    if anchored {
        path.len() >= pos + last.len() && path.ends_with(last)
    } else {
        path[pos..].contains(last)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AGENT: &str = "scaryspiderseo";

    fn parse(body: &str) -> RobotsRules {
        RobotsRules::parse(body, AGENT)
    }

    #[test]
    fn allow_all_has_no_rules_or_delay() {
        let rules = RobotsRules::allow_all();
        assert!(rules.is_allowed("/anything"));
        assert_eq!(rules.crawl_delay_ms, None);
    }

    #[test]
    fn product_token_is_the_lowercased_first_word() {
        assert_eq!(
            product_token("ScarySpiderSEO/0.1 (+https://x.com)"),
            "scaryspiderseo"
        );
        assert_eq!(product_token("Mozilla/5.0 (Windows)"), "mozilla");
    }

    #[test]
    fn disallow_blocks_matching_prefix() {
        let rules = parse("User-agent: *\nDisallow: /admin\n");
        assert!(!rules.is_allowed("/admin"));
        assert!(!rules.is_allowed("/admin/settings"));
        assert!(rules.is_allowed("/blog"));
    }

    #[test]
    fn longer_allow_overrides_shorter_disallow() {
        let rules = parse("User-agent: *\nDisallow: /private\nAllow: /private/public-page\n");
        assert!(!rules.is_allowed("/private/secret"));
        assert!(rules.is_allowed("/private/public-page"));
        assert!(rules.is_allowed("/private/public-page/sub"));
    }

    #[test]
    fn allow_wins_a_tie_with_disallow() {
        let rules = parse("User-agent: *\nDisallow: /a\nAllow: /a\n");
        assert!(rules.is_allowed("/a"));
        let rules = parse("User-agent: *\nAllow: /a\nDisallow: /a\n");
        assert!(rules.is_allowed("/a"));
    }

    #[test]
    fn wildcards_and_end_anchors_match() {
        let rules = parse("User-agent: *\nDisallow: /*.pdf$\nDisallow: /tmp/*/cache\n");
        assert!(!rules.is_allowed("/docs/file.pdf"));
        assert!(rules.is_allowed("/docs/file.pdf?download=1"));
        assert!(rules.is_allowed("/docs/file.pdfx"));
        assert!(!rules.is_allowed("/tmp/a/b/cache/x"));
        assert!(rules.is_allowed("/tmp/cache"));
    }

    #[test]
    fn query_strings_are_matched() {
        let rules = parse("User-agent: *\nDisallow: /search?q=\nDisallow: /*?sort=\n");
        let url = |s: &str| Url::parse(&format!("https://x.com{s}")).unwrap();
        assert!(!rules.is_url_allowed(&url("/search?q=shoes")));
        assert!(rules.is_url_allowed(&url("/search")));
        assert!(!rules.is_url_allowed(&url("/shop?sort=price")));
        assert!(rules.is_url_allowed(&url("/shop?page=2")));
    }

    #[test]
    fn a_group_naming_the_crawler_replaces_the_wildcard_group() {
        let rules = parse(
            "User-agent: *\nDisallow: /everyone\n\nUser-agent: ScarySpiderSEO\nDisallow: /spider-only\n",
        );
        assert!(!rules.is_allowed("/spider-only"));
        assert!(rules.is_allowed("/everyone"));
    }

    #[test]
    fn groups_for_other_crawlers_are_ignored() {
        let rules = parse(
            "User-agent: Googlebot\nDisallow: /googlebot-only\n\nUser-agent: *\nDisallow: /everyone\n",
        );
        assert!(rules.is_allowed("/googlebot-only"));
        assert!(!rules.is_allowed("/everyone"));
    }

    #[test]
    fn stacked_user_agent_lines_share_one_group() {
        let rules = parse("User-agent: *\nUser-agent: Googlebot\nDisallow: /shared\n");
        assert!(!rules.is_allowed("/shared"));
    }

    #[test]
    fn crawl_delay_is_parsed_as_milliseconds() {
        let rules = parse("User-agent: *\nCrawl-delay: 2\n");
        assert_eq!(rules.crawl_delay_ms, Some(2000));
    }

    #[test]
    fn crawl_delay_supports_fractional_seconds() {
        let rules = parse("User-agent: *\nCrawl-delay: 0.5\n");
        assert_eq!(rules.crawl_delay_ms, Some(500));
    }

    #[test]
    fn crawl_delay_outside_the_applicable_group_is_ignored() {
        let rules = parse("User-agent: Bingbot\nCrawl-delay: 10\n\nUser-agent: *\nDisallow: /x\n");
        assert_eq!(rules.crawl_delay_ms, None);
    }

    #[test]
    fn malformed_crawl_delay_is_ignored() {
        let rules = parse("User-agent: *\nCrawl-delay: not-a-number\n");
        assert_eq!(rules.crawl_delay_ms, None);
    }

    #[test]
    fn comments_and_blank_lines_are_ignored() {
        let rules = parse(
            "# a comment\n\nUser-agent: *\n# another comment\nDisallow: /x # trailing comment\n",
        );
        assert!(!rules.is_allowed("/x"));
        assert!(rules.is_allowed("/y"));
    }
}
