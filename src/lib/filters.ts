import type { PageResult, ResourceResult } from "../types";
import { META_FONT_PX, TITLE_FONT_PX, estimatePixelWidth } from "./pixelWidth";

export const TITLE_MIN_LENGTH = 30;
export const TITLE_MAX_LENGTH = 60;
export const LOW_TEXT_RATIO_THRESHOLD_PCT = 10;
export const SLOW_RESPONSE_THRESHOLD_MS = 600;
/** Screaming Frog's "Over 115 Characters" URL threshold, measured on the full URL. */
export const URL_MAX_LENGTH = 115;
/** Screaming Frog's Page Titles pixel-width thresholds (Arial 20 px). */
export const TITLE_MAX_PIXELS = 561;
export const TITLE_MIN_PIXELS = 200;
/** Screaming Frog's Meta Description character thresholds. */
export const META_MAX_LENGTH = 155;
export const META_MIN_LENGTH = 70;
/** Screaming Frog's Meta Description pixel-width thresholds (Arial 14 px). */
export const META_MAX_PIXELS = 985;
export const META_MIN_PIXELS = 400;
/** Screaming Frog's H1 "Over 70 Characters" threshold. */
export const H1_MAX_LENGTH = 70;

export function getDuplicateTitleSet(pages: PageResult[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    if (p.title) counts.set(p.title, (counts.get(p.title) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [title, count] of counts) {
    if (count > 1) duplicates.add(title);
  }
  return duplicates;
}

export function getDuplicateContentSet(pages: PageResult[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    if (p.contentHash) counts.set(p.contentHash, (counts.get(p.contentHash) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [hash, count] of counts) {
    if (count > 1) duplicates.add(hash);
  }
  return duplicates;
}

export function getDuplicateMetaSet(pages: PageResult[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    if (p.metaDescription) counts.set(p.metaDescription, (counts.get(p.metaDescription) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [desc, count] of counts) {
    if (count > 1) duplicates.add(desc);
  }
  return duplicates;
}

/** URL -> status of every crawled page, so a page's canonical target can be
 * cross-referenced against what we actually observed when we crawled it. */
export function getCanonicalStatusMap(pages: PageResult[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const p of pages) map.set(p.url, p.status);
  return map;
}

/** URL -> crawled page, so cross-page checks (canonical targets) can look up what the crawl
 * observed at another URL in O(1). */
export function getPageByUrlMap(pages: PageResult[]): Map<string, PageResult> {
  const map = new Map<string, PageResult>();
  for (const p of pages) map.set(p.url, p);
  return map;
}

/** Whether any page was discovered through the sitemap (`FilterContext.sitemapUsed`). */
export function getSitemapUsed(pages: PageResult[]): boolean {
  return pages.some((p) => p.discoveredViaSitemap);
}

/** Robots directives that take a value after a colon (`max-snippet: 20`). A token starting with
 * one of these is a directive, not a `botname: directive` prefix. */
const VALUED_ROBOTS_DIRECTIVES = new Set(["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"]);

/**
 * Every robots directive a page declares, from its meta robots content and its X-Robots-Tag
 * header, lowercased and trimmed (`"noindex"`, `"nofollow"`, `"max-snippet:20"`, ...). A leading
 * user-agent prefix (`googlebot: noindex`) is dropped, so the directive counts whichever crawler
 * it names.
 */
export function parseRobotsDirectives(metaRobots: string | null, xRobotsTag: string | null): Set<string> {
  const directives = new Set<string>();
  for (const source of [metaRobots, xRobotsTag]) {
    if (!source) continue;
    for (const raw of source.toLowerCase().split(",")) {
      let token = raw.trim();
      const colon = token.indexOf(":");
      if (colon > 0) {
        const head = token.slice(0, colon).trim();
        const rest = token.slice(colon + 1).trim();
        token = VALUED_ROBOTS_DIRECTIVES.has(head) ? `${head}:${rest}` : rest;
      }
      if (token) directives.add(token);
    }
  }
  return directives;
}

// Directive predicates run once per issue per page on every recount, so the parse is cached per
// page object (pages are immutable once received).
const directivesCache = new WeakMap<PageResult, Set<string>>();

function pageDirectives(p: PageResult): Set<string> {
  let directives = directivesCache.get(p);
  if (!directives) {
    directives = parseRobotsDirectives(p.metaRobots, p.xRobotsTag);
    directivesCache.set(p, directives);
  }
  return directives;
}

/**
 * Counts occurrences of a value (title / meta description / content hash) one page at
 * a time, so duplicate detection can stay incremental during a live crawl.
 *
 * During a crawl, `pages` only ever grows by appending — but `getDuplicateTitleSet` (etc.)
 * re-scan and re-hash every page crawled so far on every call. Called from a `useMemo` keyed
 * on the whole `pages` array (as the UI does, to batch updates during a crawl), that turns
 * into a full re-scan on every ~150ms batch, so total work across a long crawl trends toward
 * O(n²) in page count. A `DuplicateTracker` lets the caller ingest only the newly-arrived
 * pages each time instead of reprocessing everything already counted.
 */
export interface DuplicateTracker {
  counts: Map<string, number>;
  duplicates: Set<string>;
}

export function createDuplicateTracker(): DuplicateTracker {
  return { counts: new Map(), duplicates: new Set() };
}

/** Feeds one more observed value into the tracker, adding it to `duplicates` the moment
 * a second occurrence is seen. No-op for a falsy value (mirrors the null-title/-hash/-meta
 * handling in `getDuplicateTitleSet` etc — those pages simply don't count toward duplicates). */
export function ingestDuplicateValue(tracker: DuplicateTracker, value: string | null | undefined): void {
  if (!value) return;
  const count = (tracker.counts.get(value) ?? 0) + 1;
  tracker.counts.set(value, count);
  if (count === 2) tracker.duplicates.add(value);
}

/**
 * Everything a cross-page issue predicate may need beyond the page itself. Built once per
 * `pages` change in `App.tsx` and passed down, so every consumer classifies against the
 * same data.
 */
export interface FilterContext {
  duplicateTitles: Set<string>;
  duplicateContent: Set<string>;
  duplicateMeta: Set<string>;
  canonicalStatusMap: Map<string, number | null>;
  linkedUrls: Set<string>;
  /** Every crawled page by URL (see `getPageByUrlMap`). */
  pageByUrl: Map<string, PageResult>;
  /** True when the crawl read a sitemap, i.e. at least one page has `discoveredViaSitemap`
   * (see `getSitemapUsed`). `notInSitemap` stays silent otherwise. */
  sitemapUsed: boolean;
}

export function emptyFilterContext(): FilterContext {
  return {
    duplicateTitles: new Set(),
    duplicateContent: new Set(),
    duplicateMeta: new Set(),
    canonicalStatusMap: new Map(),
    linkedUrls: new Set(),
    pageByUrl: new Map(),
    sitemapUsed: false,
  };
}

export type IssueGroup = "response" | "content" | "links" | "indexing" | "technical" | "accessibility";

/** Overview accordion section an issue is listed under. An issue without one (the 4xx/5xx
 * status bucket) is shown as a top-level tile instead. Sections appear on screen in the
 * order they first occur in `ISSUE_DEFS`. */
export type OverviewSection =
  | "Titles"
  | "Content"
  | "Canonical & Indexing"
  | "Performance"
  | "Meta & Social"
  | "Mobile Usability"
  | "Structured Data"
  | "Accessibility"
  | "Security"
  | "International"
  | "URL";

interface IssueDefBase<K extends string> {
  key: K;
  /** Short label shown on the Overview tile. */
  label: string;
  group: IssueGroup;
  /** Overview colour: `bad` for things that break indexing or users, `warn` otherwise;
   * absent for neutral, informational counts. */
  tone?: "warn" | "bad";
  section?: OverviewSection;
}

export interface PageIssueDef<K extends string = string> extends IssueDefBase<K> {
  scope: "page";
  test: (page: PageResult, ctx: FilterContext) => boolean;
  /** Optional per-resource signal for the same issue. Only used to list the issue on a
   * resource's detail view (`getResourceIssueKeys`); it does not filter the Resources table. */
  resourceTest?: (resource: ResourceResult) => boolean;
}

export interface ResourceIssueDef<K extends string = string> extends IssueDefBase<K> {
  scope: "resource";
  test: (resource: ResourceResult, ctx: FilterContext) => boolean;
}

export type IssueDef<K extends string = string> = PageIssueDef<K> | ResourceIssueDef<K>;

function pageIssue<K extends string>(def: Omit<PageIssueDef<K>, "scope">): PageIssueDef<K> {
  return { ...def, scope: "page" };
}

function resourceIssue<K extends string>(def: Omit<ResourceIssueDef<K>, "scope">): ResourceIssueDef<K> {
  return { ...def, scope: "resource" };
}

const hasHtml = (p: PageResult) => p.htmlSizeBytes > 0;

interface UrlParts {
  /** Path as stored by the crawler (percent-encoded). */
  path: string;
  /** Query string including the leading `?`; empty for no query or a bare trailing `?`. */
  query: string;
}

// URL structure predicates run once per issue per page on every recount, so the parse is
// cached per page object (pages are immutable once received).
const urlPartsCache = new WeakMap<PageResult, UrlParts | null>();

function urlParts(p: PageResult): UrlParts | null {
  const cached = urlPartsCache.get(p);
  if (cached !== undefined) return cached;
  let parts: UrlParts | null;
  try {
    const u = new URL(p.url);
    parts = { path: u.pathname, query: u.search };
  } catch {
    parts = null;
  }
  urlPartsCache.set(p, parts);
  return parts;
}

/** URL structure issues only apply to URLs that answered 2xx or 3xx, so a broken URL is
 * reported once (as 4xx/5xx) rather than again for its shape. */
const isLiveUrl = (p: PageResult) => p.status !== null && p.status >= 200 && p.status < 400;

/** Runs `test` on the path plus query of a live page's URL (never the host). */
function urlIssue(test: (parts: UrlParts) => boolean): (p: PageResult) => boolean {
  return (p) => {
    if (!isLiveUrl(p)) return false;
    const parts = urlParts(p);
    return parts !== null && test(parts);
  };
}

// Pixel widths are read by several predicates and the Pages table columns on every recount,
// so each is computed once per page object (pages are immutable once received).
const titlePixelCache = new WeakMap<PageResult, number>();
const metaPixelCache = new WeakMap<PageResult, number>();

function cachedWidth(cache: WeakMap<PageResult, number>, p: PageResult, text: string | null, fontPx: number): number {
  let width = cache.get(p);
  if (width === undefined) {
    width = text ? estimatePixelWidth(text, fontPx) : 0;
    cache.set(p, width);
  }
  return width;
}

/** Estimated SERP width of the page title in pixels (0 when there is no title). */
export function getTitlePixelWidth(p: PageResult): number {
  return cachedWidth(titlePixelCache, p, p.title, TITLE_FONT_PX);
}

/** Estimated SERP width of the meta description in pixels (0 when there is none). */
export function getMetaPixelWidth(p: PageResult): number {
  return cachedWidth(metaPixelCache, p, p.metaDescription, META_FONT_PX);
}

/** Case-insensitive, whitespace-collapsed form used to compare a title with an H1. */
function normalizeHeadingText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Number of characters (code points, like the crawler's lengths) in the first H1. */
const h1Length = (p: PageResult) => (p.h1 ? Array.from(p.h1.trim()).length : 0);

/** The crawled page a page's canonical points at, or undefined when the canonical is missing,
 * self-referencing, or its target was not crawled. */
function canonicalTarget(p: PageResult, ctx: FilterContext): PageResult | undefined {
  if (!p.canonical || p.canonical === p.url) return undefined;
  return ctx.pageByUrl.get(p.canonical);
}

const is2xx = (p: PageResult) => p.status !== null && p.status >= 200 && p.status < 300;

const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/g;
/** A percent-escaped byte >= 0x80, i.e. part of an encoded non-ASCII (UTF-8) character. */
const NON_ASCII_ESCAPE = /%[89A-Fa-f][0-9A-Fa-f]/;

/**
 * The single source of truth for every audit issue: its predicate, Overview label, tone and
 * placement. Adding an issue means one entry here plus its solution in `issueSolutions.ts`
 * (a missing solution is a type error). Entries are in Overview visual order, which is also
 * the order `getPageIssueKeys` reports keys in.
 */
export const ISSUE_DEFS = [
  pageIssue({
    key: "4xx5xx",
    label: "4xx/5xx/Error",
    group: "response",
    tone: "bad",
    test: (p) => p.status === null || p.status >= 400,
  }),
  pageIssue({
    key: "missingTitle",
    label: "Missing title",
    group: "content",
    section: "Titles",
    test: (p) => !p.title,
  }),
  pageIssue({
    key: "duplicateTitles",
    label: "Duplicate titles",
    group: "content",
    section: "Titles",
    test: (p, ctx) => !!p.title && ctx.duplicateTitles.has(p.title),
  }),
  pageIssue({
    key: "titleTooShort",
    label: "Title too short",
    group: "content",
    section: "Titles",
    test: (p) => !!p.title && p.titleLength < TITLE_MIN_LENGTH,
  }),
  pageIssue({
    key: "titleTooLong",
    label: "Title too long",
    group: "content",
    section: "Titles",
    test: (p) => p.titleLength > TITLE_MAX_LENGTH,
  }),
  pageIssue({
    key: "titleOverPixels",
    label: `Title over ${TITLE_MAX_PIXELS} px`,
    group: "content",
    section: "Titles",
    test: (p) => !!p.title && getTitlePixelWidth(p) > TITLE_MAX_PIXELS,
  }),
  pageIssue({
    key: "titleUnderPixels",
    label: `Title below ${TITLE_MIN_PIXELS} px`,
    group: "content",
    section: "Titles",
    test: (p) => !!p.title && getTitlePixelWidth(p) < TITLE_MIN_PIXELS,
  }),
  pageIssue({
    key: "titleSameAsH1",
    label: "Title same as H1",
    group: "content",
    section: "Titles",
    test: (p) => {
      if (!p.title || !p.h1) return false;
      const title = normalizeHeadingText(p.title);
      return title.length > 0 && title === normalizeHeadingText(p.h1);
    },
  }),
  pageIssue({
    key: "missingMeta",
    label: "Missing meta desc.",
    group: "content",
    section: "Content",
    test: (p) => !p.metaDescription,
  }),
  pageIssue({
    key: "duplicateMeta",
    label: "Duplicate meta desc.",
    group: "content",
    section: "Content",
    test: (p, ctx) => !!p.metaDescription && ctx.duplicateMeta.has(p.metaDescription),
  }),
  pageIssue({
    key: "metaTooLong",
    label: `Meta desc. over ${META_MAX_LENGTH} chars`,
    group: "content",
    section: "Content",
    test: (p) => !!p.metaDescription && p.metaDescriptionLength > META_MAX_LENGTH,
  }),
  pageIssue({
    key: "metaTooShort",
    label: `Meta desc. below ${META_MIN_LENGTH} chars`,
    group: "content",
    section: "Content",
    test: (p) => !!p.metaDescription && p.metaDescriptionLength < META_MIN_LENGTH,
  }),
  pageIssue({
    key: "metaOverPixels",
    label: `Meta desc. over ${META_MAX_PIXELS} px`,
    group: "content",
    section: "Content",
    test: (p) => !!p.metaDescription && getMetaPixelWidth(p) > META_MAX_PIXELS,
  }),
  pageIssue({
    key: "metaUnderPixels",
    label: `Meta desc. below ${META_MIN_PIXELS} px`,
    group: "content",
    section: "Content",
    test: (p) => !!p.metaDescription && getMetaPixelWidth(p) < META_MIN_PIXELS,
  }),
  pageIssue({
    key: "h1Issues",
    label: "H1 issues",
    group: "content",
    section: "Content",
    // Missing (0) and multiple (>1) H1s in one issue.
    test: (p) => p.h1Count !== 1,
  }),
  pageIssue({
    key: "h1TooLong",
    label: `H1 over ${H1_MAX_LENGTH} chars`,
    group: "content",
    section: "Content",
    test: (p) => h1Length(p) > H1_MAX_LENGTH,
  }),
  pageIssue({
    key: "duplicateContent",
    label: "Duplicate content",
    group: "content",
    section: "Content",
    test: (p, ctx) => !!p.contentHash && ctx.duplicateContent.has(p.contentHash),
  }),
  pageIssue({
    key: "lowTextRatio",
    label: "Low text/HTML ratio",
    group: "content",
    tone: "warn",
    section: "Content",
    test: (p) => hasHtml(p) && p.textRatioPct < LOW_TEXT_RATIO_THRESHOLD_PCT,
  }),
  pageIssue({
    key: "missingAlt",
    label: "Missing alt text",
    group: "accessibility",
    tone: "warn",
    section: "Content",
    test: (p) => p.missingAltCount > 0,
  }),
  pageIssue({
    key: "nofollowLinks",
    label: "Nofollow links",
    group: "links",
    section: "Content",
    test: (p) => p.internalNofollowCount > 0,
  }),
  pageIssue({
    key: "unminified",
    label: "Unminified pages",
    group: "technical",
    tone: "warn",
    section: "Content",
    test: (p) => hasHtml(p) && !p.isMinified,
  }),
  pageIssue({
    key: "multipleCanonical",
    label: "Multiple canonical tags",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p) => p.canonicalCount > 1,
  }),
  pageIssue({
    key: "brokenCanonicalTarget",
    label: "Canonical points to broken page",
    group: "indexing",
    tone: "bad",
    section: "Canonical & Indexing",
    test: (p, ctx) => {
      if (!p.canonical || p.canonical === p.url) return false;
      if (!ctx.canonicalStatusMap.has(p.canonical)) return false;
      const targetStatus = ctx.canonicalStatusMap.get(p.canonical);
      return targetStatus === null || targetStatus === undefined || targetStatus >= 400;
    },
  }),
  pageIssue({
    key: "missingCanonical",
    label: "Missing canonical",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    // A redirected URL is reported by its destination, not for a canonical of its own.
    test: (p) => hasHtml(p) && is2xx(p) && !p.redirectUrl && !p.canonical,
  }),
  pageIssue({
    key: "canonicalised",
    label: "Canonicalised",
    group: "indexing",
    section: "Canonical & Indexing",
    test: (p) => p.indexability === "Canonicalised",
  }),
  pageIssue({
    key: "canonicalToNonIndexable",
    label: "Canonical to non-indexable page",
    group: "indexing",
    tone: "bad",
    section: "Canonical & Indexing",
    test: (p, ctx) => {
      const target = canonicalTarget(p, ctx);
      return target !== undefined && target.indexability !== "Indexable";
    },
  }),
  pageIssue({
    key: "canonicalToRedirect",
    label: "Canonical to redirect",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p, ctx) => {
      const target = canonicalTarget(p, ctx);
      if (!target) return false;
      const status3xx = target.status !== null && target.status >= 300 && target.status < 400;
      return status3xx || !!target.redirectUrl;
    },
  }),
  pageIssue({
    key: "directiveNoindex",
    label: "Noindex directive",
    group: "indexing",
    section: "Canonical & Indexing",
    test: (p) => pageDirectives(p).has("noindex"),
  }),
  pageIssue({
    key: "directiveNofollow",
    label: "Nofollow directive",
    group: "indexing",
    section: "Canonical & Indexing",
    test: (p) => pageDirectives(p).has("nofollow"),
  }),
  pageIssue({
    key: "directiveNone",
    label: "None directive",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p) => pageDirectives(p).has("none"),
  }),
  pageIssue({
    key: "xRobotsTagPresent",
    label: "Directives in X-Robots-Tag",
    group: "indexing",
    section: "Canonical & Indexing",
    test: (p) => parseRobotsDirectives(null, p.xRobotsTag).size > 0,
  }),
  pageIssue({
    key: "redirectChainTooLong",
    label: "Long redirect chains",
    group: "response",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p) => p.redirectChain.length > 1,
  }),
  pageIssue({
    key: "orphanPage",
    label: "Orphan pages (sitemap only)",
    group: "links",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p, ctx) => p.discoveredViaSitemap && !ctx.linkedUrls.has(p.url),
  }),
  pageIssue({
    key: "sitemapNonIndexable",
    label: "Non-indexable URLs in sitemap",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p) => p.discoveredViaSitemap && p.indexability !== "Indexable",
  }),
  pageIssue({
    key: "sitemapNon200",
    label: "Non-200 URLs in sitemap",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    // A redirected URL is stored with its destination's status, so `redirectUrl` marks a 3xx.
    test: (p) => p.discoveredViaSitemap && (p.status !== 200 || !!p.redirectUrl),
  }),
  pageIssue({
    key: "notInSitemap",
    label: "Indexable URLs not in sitemap",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    // The start URL (depth 0) is fetched before the sitemap is read, so it never carries
    // `discoveredViaSitemap` even when the sitemap lists it; it is skipped.
    test: (p, ctx) =>
      ctx.sitemapUsed && !p.discoveredViaSitemap && p.depth > 0 && hasHtml(p) && p.indexability === "Indexable",
  }),
  pageIssue({
    key: "slowResponse",
    label: `Slow response (>${SLOW_RESPONSE_THRESHOLD_MS}ms)`,
    group: "response",
    tone: "warn",
    section: "Performance",
    test: (p) => p.responseTimeMs > SLOW_RESPONSE_THRESHOLD_MS,
  }),
  pageIssue({
    key: "missingSocialTags",
    label: "Missing OG/Twitter tags",
    group: "content",
    section: "Meta & Social",
    test: (p) => hasHtml(p) && !p.hasOpenGraph && !p.hasTwitterCard,
  }),
  pageIssue({
    key: "missingViewport",
    label: "Missing viewport tag",
    group: "technical",
    tone: "warn",
    section: "Mobile Usability",
    test: (p) => hasHtml(p) && !p.viewport,
  }),
  pageIssue({
    key: "mobileUsabilityIssues",
    label: "Mobile usability issues",
    group: "accessibility",
    tone: "bad",
    section: "Mobile Usability",
    test: (p) => p.mobileUsabilityViolations.length > 0,
  }),
  pageIssue({
    key: "structuredDataErrors",
    label: "Invalid structured data",
    group: "technical",
    tone: "bad",
    section: "Structured Data",
    test: (p) => p.structuredDataErrors.length > 0,
  }),
  pageIssue({
    key: "missingStructuredData",
    label: "No structured data",
    group: "technical",
    section: "Structured Data",
    test: (p) => hasHtml(p) && p.structuredDataTypes.length === 0,
  }),
  pageIssue({
    key: "accessibilityIssues",
    label: "Accessibility violations",
    group: "accessibility",
    tone: "bad",
    section: "Accessibility",
    test: (p) => p.accessibilityViolations.length > 0,
  }),
  resourceIssue({
    key: "broken",
    label: "Broken links/images",
    group: "links",
    tone: "bad",
    section: "Security",
    test: (r) => (r.status !== null && r.status >= 400) || !!r.error,
  }),
  pageIssue({
    key: "insecureLinks",
    label: "Insecure links",
    group: "technical",
    tone: "bad",
    section: "Security",
    test: (p) => p.insecureLinkCount > 0,
    resourceTest: (r) => !!r.isInsecure,
  }),
  pageIssue({
    key: "missingHsts",
    label: "Missing HSTS",
    group: "technical",
    tone: "warn",
    section: "Security",
    test: (p) => p.url.startsWith("https:") && !p.hsts,
  }),
  pageIssue({
    key: "missingLang",
    label: "Missing lang attr.",
    group: "indexing",
    section: "International",
    test: (p) => hasHtml(p) && !p.lang,
  }),
  pageIssue({
    key: "missingHreflang",
    label: "Missing hreflang",
    group: "indexing",
    section: "International",
    test: (p) => hasHtml(p) && p.hreflangValues.length === 0,
  }),
  pageIssue({
    key: "urlUppercase",
    label: "Uppercase in URL",
    group: "technical",
    tone: "warn",
    section: "URL",
    // Hex digits of percent-escapes (e.g. %C3) are uppercase by convention, not by choice.
    test: urlIssue(({ path, query }) => /[A-Z]/.test((path + query).replace(PERCENT_ESCAPE, ""))),
  }),
  pageIssue({
    key: "urlUnderscores",
    label: "Underscores in URL",
    group: "technical",
    section: "URL",
    test: urlIssue(({ path, query }) => (path + query).includes("_")),
  }),
  pageIssue({
    key: "urlParameters",
    label: "URL has parameters",
    group: "technical",
    section: "URL",
    test: urlIssue(({ query }) => query.length > 0),
  }),
  pageIssue({
    key: "urlOver115",
    label: `URL over ${URL_MAX_LENGTH} characters`,
    group: "technical",
    tone: "warn",
    section: "URL",
    test: (p) => isLiveUrl(p) && p.url.length > URL_MAX_LENGTH,
  }),
  pageIssue({
    key: "urlNonAscii",
    label: "Non-ASCII characters in URL",
    group: "technical",
    tone: "warn",
    section: "URL",
    test: urlIssue(({ path, query }) => NON_ASCII_ESCAPE.test(path + query)),
  }),
  pageIssue({
    key: "urlMultipleSlashes",
    label: "Multiple slashes in URL",
    group: "technical",
    tone: "warn",
    section: "URL",
    test: urlIssue(({ path }) => path.includes("//")),
  }),
] as const;

export type IssueKey = (typeof ISSUE_DEFS)[number]["key"];

/** Status buckets plus every registry issue. */
export type FilterKey = "all" | "2xx" | "3xx" | IssueKey;

const ALL_ISSUE_DEFS: readonly IssueDef<IssueKey>[] = ISSUE_DEFS;
const ISSUE_DEF_BY_KEY: ReadonlyMap<string, IssueDef<IssueKey>> = new Map(ALL_ISSUE_DEFS.map((d) => [d.key, d]));
const PAGE_ISSUE_DEFS = ALL_ISSUE_DEFS.filter((d): d is PageIssueDef<IssueKey> => d.scope === "page");
const RESOURCE_ISSUE_DEFS = ALL_ISSUE_DEFS.filter((d): d is ResourceIssueDef<IssueKey> => d.scope === "resource");

/** The registry entry for a filter key, or undefined for "all" and the status buckets. */
export function getIssueDef(key: FilterKey): IssueDef<IssueKey> | undefined {
  return ISSUE_DEF_BY_KEY.get(key);
}

/** Which tab a filter's results live in — null means it doesn't imply a tab (e.g. "all"). */
export function filterTab(filter: FilterKey): "pages" | "resources" | null {
  if (filter === "all") return null;
  return getIssueDef(filter)?.scope === "resource" ? "resources" : "pages";
}

function statusClass(status: number | null): number | null {
  return status === null ? null : Math.floor(status / 100);
}

/** Pages matching `filter`. Resource-scope issues and "all" leave the page list unfiltered. */
export function filterPages(pages: PageResult[], filter: FilterKey, ctx: FilterContext): PageResult[] {
  if (filter === "2xx") return pages.filter((p) => statusClass(p.status) === 2);
  if (filter === "3xx") return pages.filter((p) => statusClass(p.status) === 3);
  const def = getIssueDef(filter);
  if (def?.scope !== "page") return pages;
  return pages.filter((p) => def.test(p, ctx));
}

/** Resources matching `filter`. Page-scope issues and "all" leave the resource list unfiltered. */
export function filterResources(
  resources: ResourceResult[],
  filter: FilterKey,
  ctx: FilterContext = emptyFilterContext(),
): ResourceResult[] {
  const def = getIssueDef(filter);
  if (def?.scope !== "resource") return resources;
  return resources.filter((r) => def.test(r, ctx));
}

/** Number of pages (page-scope issues) or resources (resource-scope issues) affected by every
 * issue in the registry. Always equals the length of `filterPages` / `filterResources` for
 * the same key. */
export function countIssues(
  pages: PageResult[],
  resources: ResourceResult[],
  ctx: FilterContext,
): Record<IssueKey, number> {
  const counts = {} as Record<IssueKey, number>;
  for (const def of ALL_ISSUE_DEFS) counts[def.key] = 0;
  for (const p of pages) {
    for (const def of PAGE_ISSUE_DEFS) if (def.test(p, ctx)) counts[def.key]++;
  }
  for (const r of resources) {
    for (const def of RESOURCE_ISSUE_DEFS) if (def.test(r, ctx)) counts[def.key]++;
  }
  return counts;
}

/** Free-text search across a page's URL, title, meta description and H1 — case-insensitive substring match. */
export function searchPages(pages: PageResult[], query: string): PageResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  return pages.filter(
    (p) =>
      p.url.toLowerCase().includes(q) ||
      (p.title?.toLowerCase().includes(q) ?? false) ||
      (p.metaDescription?.toLowerCase().includes(q) ?? false) ||
      (p.h1?.toLowerCase().includes(q) ?? false),
  );
}

/** Free-text search across a resource's URL, source page and alt text — case-insensitive substring match. */
export function searchResources(resources: ResourceResult[], query: string): ResourceResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return resources;
  return resources.filter(
    (r) =>
      r.url.toLowerCase().includes(q) ||
      r.sourcePage.toLowerCase().includes(q) ||
      (r.altText?.toLowerCase().includes(q) ?? false),
  );
}

/** Which page-scope issue keys apply to a single page, in registry order. */
export function getPageIssueKeys(page: PageResult, ctx: FilterContext): IssueKey[] {
  return PAGE_ISSUE_DEFS.filter((def) => def.test(page, ctx)).map((def) => def.key);
}

/** Which issue keys apply to a single resource: resource-scope issues plus page-scope issues
 * that declare a `resourceTest`, in registry order. */
export function getResourceIssueKeys(
  resource: ResourceResult,
  ctx: FilterContext = emptyFilterContext(),
): IssueKey[] {
  const keys: IssueKey[] = [];
  for (const def of ALL_ISSUE_DEFS) {
    const applies = def.scope === "resource" ? def.test(resource, ctx) : (def.resourceTest?.(resource) ?? false);
    if (applies) keys.push(def.key);
  }
  return keys;
}
