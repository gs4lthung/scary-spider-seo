//! User-supplied include/exclude URL patterns that restrict which discovered URLs a
//! crawl schedules. Patterns are regular expressions matched (unanchored) against the
//! full URL string. The start URL is never filtered; `run_crawl` only applies the
//! scope to discovered internal links and sitemap URLs.

use regex::{Regex, RegexBuilder};
use url::Url;

/// Upper bound on the compiled size of a single pattern, so a hostile or accidental
/// pattern (e.g. huge counted repetitions) cannot exhaust memory.
const PATTERN_SIZE_LIMIT: usize = 1 << 20;

#[derive(Debug, Clone, Default)]
pub struct UrlScope {
    include: Vec<Regex>,
    exclude: Vec<Regex>,
}

fn compile(patterns: &[String], kind: &str) -> Result<Vec<Regex>, String> {
    let mut compiled = Vec::new();
    let non_blank = patterns.iter().map(|p| p.trim()).filter(|p| !p.is_empty());
    for (index, pattern) in non_blank.enumerate() {
        let regex = RegexBuilder::new(pattern)
            .size_limit(PATTERN_SIZE_LIMIT)
            .build()
            .map_err(|e| format!("Invalid {kind} pattern {}: {e}", index + 1))?;
        compiled.push(regex);
    }
    Ok(compiled)
}

impl UrlScope {
    /// Compiles both pattern lists. Blank entries are ignored. The error names the
    /// list and the 1-based position, among the non-blank entries, of the first pattern
    /// that fails to compile.
    pub fn new(include: &[String], exclude: &[String]) -> Result<UrlScope, String> {
        Ok(UrlScope {
            include: compile(include, "include")?,
            exclude: compile(exclude, "exclude")?,
        })
    }

    /// A URL is in scope when it matches at least one include pattern (or there are
    /// none) and matches no exclude pattern. Exclude wins over include. The URL is
    /// matched without its fragment, i.e. in the same form the crawler dedups and
    /// records pages by.
    pub fn allows(&self, url: &Url) -> bool {
        let s = url.as_str();
        let s = s.split_once('#').map_or(s, |(before, _)| before);
        if self.exclude.iter().any(|r| r.is_match(s)) {
            return false;
        }
        self.include.is_empty() || self.include.iter().any(|r| r.is_match(s))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    fn strings(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn empty_scope_allows_everything() {
        let scope = UrlScope::new(&[], &[]).unwrap();
        assert!(scope.allows(&url("https://example.com/")));
        assert!(scope.allows(&url("https://example.com/a/b?c=d")));
        let blanks = UrlScope::new(&strings(&["", "  "]), &strings(&[""])).unwrap();
        assert!(blanks.allows(&url("https://example.com/anything")));
    }

    #[test]
    fn include_requires_a_match() {
        let scope = UrlScope::new(&strings(&["/blog/", r"\.pdf$"]), &[]).unwrap();
        assert!(scope.allows(&url("https://example.com/blog/post")));
        assert!(scope.allows(&url("https://example.com/files/a.pdf")));
        assert!(!scope.allows(&url("https://example.com/about")));
    }

    #[test]
    fn exclude_wins_over_include() {
        let scope = UrlScope::new(&strings(&["/blog/"]), &strings(&["draft"])).unwrap();
        assert!(scope.allows(&url("https://example.com/blog/post")));
        assert!(!scope.allows(&url("https://example.com/blog/draft-post")));
        let exclude_only = UrlScope::new(&[], &strings(&[r"\?"])).unwrap();
        assert!(!exclude_only.allows(&url("https://example.com/p?x=1")));
        assert!(exclude_only.allows(&url("https://example.com/p")));
    }

    #[test]
    fn fragment_is_ignored_when_matching() {
        let scope = UrlScope::new(&[], &strings(&["section$"])).unwrap();
        assert!(!scope.allows(&url("https://example.com/section#top")));
        let scope = UrlScope::new(&[], &strings(&["top"])).unwrap();
        assert!(scope.allows(&url("https://example.com/page#top")));
    }

    #[test]
    fn invalid_pattern_reports_its_index() {
        let err = UrlScope::new(&strings(&["ok", "(unclosed"]), &[]).unwrap_err();
        assert!(err.starts_with("Invalid include pattern 2: "), "{err}");
        let err = UrlScope::new(&[], &strings(&["[bad"])).unwrap_err();
        assert!(err.starts_with("Invalid exclude pattern 1: "), "{err}");
        // Blank lines don't count toward the position.
        let err = UrlScope::new(&strings(&["", "ok", "  ", "(bad"]), &[]).unwrap_err();
        assert!(err.starts_with("Invalid include pattern 2: "), "{err}");
        let err = UrlScope::new(&strings(&["a{1000}{1000}{1000}"]), &[]).unwrap_err();
        assert!(err.starts_with("Invalid include pattern 1: "), "{err}");
    }
}
