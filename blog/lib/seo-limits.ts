// Mirrors the thresholds the desktop crawler itself flags
// (src/lib/filters.ts: TITLE_MIN_LENGTH / TITLE_MAX_LENGTH), so a post
// that looks "good" in this form also passes a Scary Spider SEO crawl.
export const TITLE_MIN_LENGTH = 30;
export const TITLE_MAX_LENGTH = 60;
// The crawler only flags a missing meta description, not its length —
// this is the general best-practice target for the ~155-char SERP snippet.
export const META_DESCRIPTION_TARGET_MAX = 155;
export const THIN_CONTENT_WORD_COUNT = 300;
