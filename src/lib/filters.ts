import type { CustomSearchRule, PageResult, RawSignals, ResourceResult } from "../types";
import { isValidHreflang, isXDefault } from "./hreflang";
import { type LinkGraph, buildLinkGraph, createLinkGraph, getUniqueInlinkCount } from "./linkGraph";
import type { NearDuplicateCluster } from "./nearDuplicates";
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
/** Screaming Frog's H2 "Over 70 Characters" threshold. */
export const H2_MAX_LENGTH = 70;
/** A 2xx HTML page with fewer words than this is "low content" (Screaming Frog's default). */
export const LOW_WORD_COUNT = 200;
/** Pages more clicks than this from the start URL are "deep". */
export const DEEP_PAGE_DEPTH = 3;
/** HTML documents larger than this (1 MiB) are "large HTML". */
export const LARGE_HTML_BYTES = 1_048_576;
/** Images larger than this (100 KB, Screaming Frog's "Over 100 KB" default) are "large images". */
export const LARGE_IMAGE_BYTES = 102_400;
/** A rendered page whose raw HTML has fewer words than this fraction of the rendered word
 * count gets most of its content from JavaScript. */
export const JS_RAW_WORD_RATIO = 0.5;
/** A rendered page with more than this many internal links beyond its raw HTML's count
 * gets its links from JavaScript. */
export const JS_ADDED_LINKS_THRESHOLD = 5;

/** Anchor texts that say nothing about the target (compared lowercase, after trimming
 * punctuation and collapsing whitespace, by `isNonDescriptiveAnchor`). */
export const NON_DESCRIPTIVE_ANCHORS: ReadonlySet<string> = new Set([
  "click here",
  "here",
  "read more",
  "more",
  "learn more",
  "this",
  "link",
  "this link",
  "go",
  "continue",
  "details",
]);

const EDGE_PUNCTUATION = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu;

/** Whether an anchor text is one of `NON_DESCRIPTIVE_ANCHORS` ("Read more..." and "→ Click
 * here" included). */
export function isNonDescriptiveAnchor(anchor: string): boolean {
  const normalized = anchor.replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ").toLowerCase();
  return NON_DESCRIPTIVE_ANCHORS.has(normalized);
}

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

/** The heading a page is compared on for duplicate H1s: its first H1, like Screaming Frog. */
export const firstH1 = (p: PageResult): string | null => p.h1;

/** The heading a page is compared on for duplicate H2s: its first H2, like Screaming Frog. */
export const firstH2 = (p: PageResult): string | null => p.h2Values[0] ?? null;

function getDuplicateSet(pages: PageResult[], value: (p: PageResult) => string | null): Set<string> {
  const tracker = createDuplicateTracker();
  for (const p of pages) ingestDuplicateValue(tracker, value(p));
  return tracker.duplicates;
}

export function getDuplicateH1Set(pages: PageResult[]): Set<string> {
  return getDuplicateSet(pages, firstH1);
}

export function getDuplicateH2Set(pages: PageResult[]): Set<string> {
  return getDuplicateSet(pages, firstH2);
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

/** Indexability the crawler gives a URL it did not fetch because robots.txt disallows it
 * (`robots_blocked_result` in crawl.rs: no status, no error). */
const ROBOTS_BLOCKED_INDEXABILITY = "Non-Indexable (robots.txt)";

/**
 * Whether links to this crawled page count as links to a non-200 page: it answered an error
 * status, gave no response, or redirected (marked by its chain, since the crawler stores the
 * final status on a redirected URL). A robots-blocked URL was never requested, so its status
 * is unknown rather than an error.
 */
export function isNon200LinkTarget(p: PageResult): boolean {
  if (p.status === null && p.indexability === ROBOTS_BLOCKED_INDEXABILITY) return false;
  return p.status !== 200 || p.redirectChain.length > 0;
}

/**
 * Adds to `sources` every page that links to a crawled non-200 page, as `page` joins the crawl.
 * Call it after `page` is in both `graph` and `pageByUrl`: earlier pages linking to `page` are
 * found through the graph, and `page`'s own outlinks are checked once against the pages
 * crawled so far, so a live crawl never rescans old links. Targets the crawl never reached
 * are unknown and not counted.
 */
export function ingestNon200LinkSources(
  sources: Set<string>,
  graph: LinkGraph,
  pageByUrl: ReadonlyMap<string, PageResult>,
  page: PageResult,
): void {
  if (isNon200LinkTarget(page)) {
    for (const source of graph.targets.get(page.url)?.sources ?? []) sources.add(source);
  }
  if (sources.has(page.url)) return;
  for (const link of page.outlinks) {
    if (link.url === page.url) continue;
    const target = pageByUrl.get(link.url);
    if (target && isNon200LinkTarget(target)) {
      sources.add(page.url);
      return;
    }
  }
}

/** URLs of pages that link to a crawled non-200 page (`FilterContext.non200LinkSources`). */
export function getNon200LinkSourceSet(pages: PageResult[]): Set<string> {
  const graph = buildLinkGraph(pages);
  const pageByUrl = getPageByUrlMap(pages);
  const sources = new Set<string>();
  for (const page of pages) ingestNon200LinkSources(sources, graph, pageByUrl, page);
  return sources;
}

/**
 * Cross-page hreflang findings, built one page at a time so a live crawl never rescans old
 * annotations (see ADR-0013). Each (source, target) pair is evaluated exactly once, as soon as
 * both pages are crawled: a page's own targets are checked against pages already crawled, and a
 * target not crawled yet parks the source in `waiting` until it arrives.
 */
export interface HreflangTracker {
  /** Pages with a crawled HTML hreflang target that does not annotate them back. */
  missingReturn: Set<string>;
  /** Pages with a crawled hreflang target that is non-200, redirected or not indexable. */
  targetError: Set<string>;
  /** Target URL not crawled yet -> source pages annotating it. */
  waiting: Map<string, string[]>;
}

export function createHreflangTracker(): HreflangTracker {
  return { missingReturn: new Set(), targetError: new Set(), waiting: new Map() };
}

// Hreflang href sets are read for every page annotating a target, so each is built once per
// page object (pages are immutable once received).
const hreflangHrefCache = new WeakMap<PageResult, Set<string>>();

function hreflangHrefs(p: PageResult): Set<string> {
  let hrefs = hreflangHrefCache.get(p);
  if (!hrefs) {
    hrefs = new Set(p.hreflangLinks.map((l) => l.href));
    hreflangHrefCache.set(p, hrefs);
  }
  return hrefs;
}

/** A crawled hreflang target that Google cannot use: it answered non-200, redirected, or is not
 * indexable. A robots-blocked target was never requested, so it is unknown rather than an error. */
export function isHreflangTargetError(target: PageResult): boolean {
  if (target.status === null && target.indexability === ROBOTS_BLOCKED_INDEXABILITY) return false;
  return isNon200LinkTarget(target) || target.indexability !== "Indexable";
}

/** Whether a page's hreflang annotations can be matched against its URL. A redirected page is
 * stored under the URL it requested while its hrefs resolve against where it landed, so it is
 * never a hreflang source (it is still checked as a target, where a redirect is an error). */
const isHreflangSource = (p: PageResult) => p.htmlSizeBytes > 0 && p.redirectChain.length === 0;

// Host of a page URL, cached per page object (pages are immutable once received).
const hostCache = new WeakMap<PageResult, string | null>();

function pageHost(p: PageResult): string | null {
  let host = hostCache.get(p);
  if (host === undefined) {
    host = hostOf(p.url);
    hostCache.set(p, host);
  }
  return host;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function evaluateHreflangPair(tracker: HreflangTracker, sourceUrl: string, target: PageResult): void {
  if (isHreflangTargetError(target)) {
    tracker.targetError.add(sourceUrl);
  } else if (target.htmlSizeBytes > 0 && !hreflangHrefs(target).has(sourceUrl)) {
    tracker.missingReturn.add(sourceUrl);
  }
}

/**
 * Feeds one crawled page into `tracker`. Call it after `page` is in `pageByUrl`. Return links
 * are only checked for targets the crawl reached; links to the page itself are skipped, and a
 * target on another host is dropped rather than parked (the crawler never queues it).
 */
export function ingestHreflangPage(
  tracker: HreflangTracker,
  pageByUrl: ReadonlyMap<string, PageResult>,
  page: PageResult,
): void {
  const waitingSources = tracker.waiting.get(page.url);
  if (waitingSources) {
    tracker.waiting.delete(page.url);
    for (const source of waitingSources) evaluateHreflangPair(tracker, source, page);
  }
  if (!isHreflangSource(page)) return;
  const host = pageHost(page);
  for (const href of hreflangHrefs(page)) {
    if (href === page.url) continue;
    const target = pageByUrl.get(href);
    if (target) {
      evaluateHreflangPair(tracker, page.url, target);
    } else if (host !== null && hostOf(href) === host) {
      const sources = tracker.waiting.get(href);
      if (sources) sources.push(page.url);
      else tracker.waiting.set(href, [page.url]);
    }
  }
}

/** Hreflang findings for a complete page list (`FilterContext.hreflangMissingReturn` and
 * `hreflangTargetError`). */
export function getHreflangTracker(pages: PageResult[]): HreflangTracker {
  const pageByUrl = getPageByUrlMap(pages);
  const tracker = createHreflangTracker();
  for (const page of pages) ingestHreflangPage(tracker, pageByUrl, page);
  return tracker;
}

interface HreflangFlags {
  missingSelf: boolean;
  missingXDefault: boolean;
  invalidCode: boolean;
}

// Per-page hreflang predicates scan the page's annotations on every recount, so the result is
// cached per page object (pages are immutable once received).
const hreflangFlagsCache = new WeakMap<PageResult, HreflangFlags>();

/** Own-page hreflang findings; all false for a page without hreflang links (including pages from
 * crawls saved before the links were collected) and for a redirected page. */
function hreflangFlags(p: PageResult): HreflangFlags {
  let flags = hreflangFlagsCache.get(p);
  if (!flags) {
    const links = isHreflangSource(p) ? p.hreflangLinks : [];
    flags = {
      missingSelf: links.length > 0 && !links.some((l) => l.href === p.url),
      missingXDefault: links.length > 0 && !links.some((l) => isXDefault(l.lang)),
      invalidCode: links.some((l) => !isValidHreflang(l.lang)),
    };
    hreflangFlagsCache.set(p, flags);
  }
  return flags;
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
  /** First-H1 texts shared by more than one page (see `getDuplicateH1Set`). */
  duplicateH1s: Set<string>;
  /** First-H2 texts shared by more than one page (see `getDuplicateH2Set`). */
  duplicateH2s: Set<string>;
  canonicalStatusMap: Map<string, number | null>;
  linkedUrls: Set<string>;
  /** Every crawled page by URL (see `getPageByUrlMap`). */
  pageByUrl: Map<string, PageResult>;
  /** True when the crawl read a sitemap, i.e. at least one page has `discoveredViaSitemap`
   * (see `getSitemapUsed`). `notInSitemap` stays silent otherwise. */
  sitemapUsed: boolean;
  /** Internal link graph of the crawl (see `buildLinkGraph`). */
  linkGraph: LinkGraph;
  /** Pages linking to a crawled non-200 page (see `getNon200LinkSourceSet`). */
  non200LinkSources: Set<string>;
  /** Pages whose crawled hreflang targets do not annotate them back (see `HreflangTracker`). */
  hreflangMissingReturn: Set<string>;
  /** Pages with a crawled hreflang target in error (see `isHreflangTargetError`). */
  hreflangTargetError: Set<string>;
  /** Pages with at least one near duplicate, by URL, with their cluster (see `nearDuplicates.ts`).
   * Exact copies alone do not count; they are `duplicateContent`. */
  nearDuplicates: Map<string, NearDuplicateCluster>;
  /** True when the results come from a list-mode crawl, which never follows links, so a
   * link target missing from the crawl is expected rather than an issue. */
  listMode: boolean;
}

export function emptyFilterContext(): FilterContext {
  return {
    duplicateTitles: new Set(),
    duplicateContent: new Set(),
    duplicateMeta: new Set(),
    duplicateH1s: new Set(),
    duplicateH2s: new Set(),
    canonicalStatusMap: new Map(),
    linkedUrls: new Set(),
    pageByUrl: new Map(),
    sitemapUsed: false,
    linkGraph: createLinkGraph(),
    non200LinkSources: new Set(),
    hreflangMissingReturn: new Set(),
    hreflangTargetError: new Set(),
    nearDuplicates: new Map(),
    listMode: false,
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
  | "JavaScript"
  | "Structured Data"
  | "Accessibility"
  | "Security"
  | "International"
  | "Links"
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

/** An HTML page whose response headers were read (false for crawls saved before the
 * security header fields existed, so those are not all reported as missing). */
const hasSecurityHeaders = (p: PageResult) => hasHtml(p) && p.securityHeadersCaptured;

const isBlank = (value: string | null | undefined) => !value || value.trim() === "";

/** Whitespace-collapsed text, so formatting differences between raw and rendered HTML
 * are not reported as a change. */
const normalizedText = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** Raw HTML signals of a rendered page, or null when the page was not compared (option off,
 * not rendered, or a crawl saved before T3.6), in which case no JavaScript issue applies. */
function comparedRaw(p: PageResult): RawSignals | null {
  return p.rendered && p.raw ? p.raw : null;
}

function sameDirectives(a: string | null, b: string | null): boolean {
  const left = parseRobotsDirectives(a, null);
  const right = parseRobotsDirectives(b, null);
  return left.size === right.size && [...left].every((d) => right.has(d));
}

export function jsChangesTitle(p: PageResult): boolean {
  const raw = comparedRaw(p);
  return !!raw && normalizedText(raw.title) !== normalizedText(p.title);
}

export function jsChangesCanonical(p: PageResult): boolean {
  const raw = comparedRaw(p);
  return !!raw && normalizedText(raw.canonical) !== normalizedText(p.canonical);
}

export function jsChangesRobots(p: PageResult): boolean {
  const raw = comparedRaw(p);
  return !!raw && !sameDirectives(raw.metaRobots, p.metaRobots);
}

export function jsAddsMostContent(p: PageResult): boolean {
  const raw = comparedRaw(p);
  return !!raw && p.wordCount > 0 && raw.wordCount < p.wordCount * JS_RAW_WORD_RATIO;
}

export function jsAddsLinks(p: PageResult): boolean {
  const raw = comparedRaw(p);
  return !!raw && p.internalLinkCount > raw.internalLinkCount + JS_ADDED_LINKS_THRESHOLD;
}

/** `X-Frame-Options`, or CSP `frame-ancestors`, which supersedes it in modern browsers. */
export function hasFrameProtection(p: PageResult): boolean {
  return !isBlank(p.xFrameOptions) || /(^|;)\s*frame-ancestors\b/i.test(p.contentSecurityPolicy ?? "");
}

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

/** Number of characters (code points, like the crawler's lengths) in a heading. */
const headingLength = (text: string) => Array.from(text.trim()).length;

/** Whether any H1 on the page (the first, plus every collected value) is over the limit. */
const anyH1TooLong = (p: PageResult) =>
  (p.h1 !== null && headingLength(p.h1) > H1_MAX_LENGTH) || p.h1Values.some((v) => headingLength(v) > H1_MAX_LENGTH);

/** False for pages from a crawl saved before heading levels were collected: such a page has an
 * H1 but no recorded levels, so its zero H2 count is unknown rather than real. */
const hasHeadingOutline = (p: PageResult) => p.headingLevels.length > 0 || p.h1Count === 0;

/** Whether a heading level ever increases by more than one step (H1 then H3, H2 then H4). */
export function hasHeadingLevelSkip(levels: readonly number[]): boolean {
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) return true;
  }
  return false;
}

/** The crawled page a page's canonical points at, or undefined when the canonical is missing,
 * self-referencing, or its target was not crawled. */
function canonicalTarget(p: PageResult, ctx: FilterContext): PageResult | undefined {
  if (!p.canonical || p.canonical === p.url) return undefined;
  return ctx.pageByUrl.get(p.canonical);
}

/** The page's rel="next" and rel="prev" targets that are set. */
function paginationTargets(p: PageResult): string[] {
  const targets: string[] = [];
  if (p.paginationNext) targets.push(p.paginationNext);
  if (p.paginationPrev) targets.push(p.paginationPrev);
  return targets;
}

/** A pagination target is in error when it was never crawled (outside the crawl's host,
 * depth or page limits) or did not answer a plain 200: an error status, or a redirect
 * (the crawler stores the final status on a redirected URL, so the chain marks it). */
function isPaginationTargetError(url: string, ctx: FilterContext): boolean {
  const target = ctx.pageByUrl.get(url);
  // List mode only crawls the listed URLs, so an uncrawled target says nothing about it.
  if (target === undefined) return !ctx.listMode;
  return target.status !== 200 || target.redirectChain.length > 0;
}

interface AnchorFlags {
  nonDescriptive: boolean;
  empty: boolean;
}

// Anchor predicates scan every outlink of a page on every recount, so the result is cached per
// page object (pages are immutable once received).
const anchorFlagsCache = new WeakMap<PageResult, AnchorFlags>();

function anchorFlags(p: PageResult): AnchorFlags {
  let flags = anchorFlagsCache.get(p);
  if (!flags) {
    flags = {
      nonDescriptive: p.outlinks.some((l) => isNonDescriptiveAnchor(l.anchor)),
      empty: p.outlinks.some((l) => l.anchor.trim() === ""),
    };
    anchorFlagsCache.set(p, flags);
  }
  return flags;
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
    key: "multipleTitles",
    label: "Multiple titles",
    group: "content",
    tone: "warn",
    section: "Titles",
    test: (p) => p.titleCount > 1,
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
    key: "multipleMetaDescriptions",
    label: "Multiple meta desc.",
    group: "content",
    tone: "warn",
    section: "Content",
    test: (p) => p.metaDescriptionCount > 1,
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
    test: anyH1TooLong,
  }),
  pageIssue({
    key: "duplicateH1",
    label: "Duplicate H1",
    group: "content",
    section: "Content",
    test: (p, ctx) => {
      const h1 = firstH1(p);
      return !!h1 && ctx.duplicateH1s.has(h1);
    },
  }),
  pageIssue({
    key: "missingH2",
    label: "Missing H2",
    group: "content",
    section: "Content",
    test: (p) => hasHtml(p) && is2xx(p) && p.h2Count === 0 && hasHeadingOutline(p),
  }),
  pageIssue({
    key: "multipleH2",
    label: "Multiple H2",
    group: "content",
    section: "Content",
    test: (p) => p.h2Count > 1,
  }),
  pageIssue({
    key: "duplicateH2",
    label: "Duplicate H2",
    group: "content",
    section: "Content",
    test: (p, ctx) => {
      const h2 = firstH2(p);
      return !!h2 && ctx.duplicateH2s.has(h2);
    },
  }),
  pageIssue({
    key: "h2TooLong",
    label: `H2 over ${H2_MAX_LENGTH} chars`,
    group: "content",
    section: "Content",
    test: (p) => p.h2Values.some((v) => headingLength(v) > H2_MAX_LENGTH),
  }),
  pageIssue({
    key: "nonSequentialHeadings",
    label: "Non-sequential headings",
    group: "accessibility",
    section: "Content",
    test: (p) => hasHeadingLevelSkip(p.headingLevels),
  }),
  pageIssue({
    key: "duplicateContent",
    label: "Duplicate content",
    group: "content",
    section: "Content",
    test: (p, ctx) => !!p.contentHash && ctx.duplicateContent.has(p.contentHash),
  }),
  pageIssue({
    key: "nearDuplicateContent",
    label: "Near-duplicate content",
    group: "content",
    tone: "warn",
    section: "Content",
    test: (p, ctx) => ctx.nearDuplicates.has(p.url),
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
    key: "lowWordCount",
    label: `Low content (<${LOW_WORD_COUNT} words)`,
    group: "content",
    tone: "warn",
    section: "Content",
    test: (p) => is2xx(p) && hasHtml(p) && p.wordCount < LOW_WORD_COUNT,
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
    key: "internalRedirect",
    label: "Internal redirects",
    group: "response",
    tone: "warn",
    section: "Canonical & Indexing",
    // The crawler follows redirects and stores the final status on the requested URL, so an
    // internally linked redirect usually shows 200; a non-empty chain is what marks it.
    test: (p, ctx) => p.redirectChain.length > 0 && ctx.linkedUrls.has(p.url),
  }),
  pageIssue({
    key: "redirectToError",
    label: "Redirects to a non-200 page",
    group: "response",
    tone: "bad",
    section: "Canonical & Indexing",
    // `status` is the final response status after following the chain (a capped loop keeps
    // its last 3xx, which also never resolves to a 200).
    test: (p) => p.redirectChain.length > 0 && p.status !== 200,
  }),
  pageIssue({
    key: "metaRefresh",
    label: "Meta refresh",
    group: "indexing",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p) => !!p.metaRefresh,
  }),
  pageIssue({
    key: "paginationTargetError",
    label: "Pagination to non-200 or uncrawled URL",
    group: "links",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p, ctx) => paginationTargets(p).some((url) => isPaginationTargetError(url, ctx)),
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
    key: "deepPage",
    label: `Deep pages (depth >${DEEP_PAGE_DEPTH})`,
    group: "links",
    tone: "warn",
    section: "Canonical & Indexing",
    test: (p) => hasHtml(p) && p.depth > DEEP_PAGE_DEPTH,
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
    // The start URL is queued before sitemap URLs are seeded, so it never carries
    // `discoveredViaSitemap` even when the sitemap lists it. Sitemap-seeded URLs also have
    // depth 0 but always carry the flag, so `depth > 0` only ever drops the start URL.
    test: (p, ctx) =>
      ctx.sitemapUsed && !p.discoveredViaSitemap && p.depth > 0 && hasHtml(p) && p.indexability === "Indexable",
  }),
  pageIssue({
    key: "nonDescriptiveAnchors",
    label: "Non-descriptive anchor text",
    group: "links",
    tone: "warn",
    section: "Links",
    test: (p) => anchorFlags(p).nonDescriptive,
  }),
  pageIssue({
    key: "emptyAnchors",
    label: "Links with empty anchor text",
    group: "links",
    tone: "warn",
    section: "Links",
    // An image link's anchor is its alt text, so an image link without alt counts too.
    test: (p) => anchorFlags(p).empty,
  }),
  pageIssue({
    key: "singleInlink",
    label: "Only one inlink",
    group: "links",
    tone: "warn",
    section: "Links",
    // The start page (depth 0) is where the crawl enters, so it needs no inlinks.
    test: (p, ctx) => is2xx(p) && hasHtml(p) && p.depth > 0 && getUniqueInlinkCount(ctx.linkGraph, p.url) === 1,
  }),
  pageIssue({
    key: "linksToErrorPages",
    label: "Links to non-200 pages",
    group: "links",
    tone: "warn",
    section: "Links",
    test: (p, ctx) => ctx.non200LinkSources.has(p.url),
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
    key: "largeHtml",
    label: "Large HTML (>1 MB)",
    group: "technical",
    tone: "warn",
    section: "Performance",
    test: (p) => p.htmlSizeBytes > LARGE_HTML_BYTES,
  }),
  resourceIssue({
    key: "largeImage",
    label: "Large images (>100 KB)",
    group: "technical",
    tone: "warn",
    section: "Performance",
    test: (r) => r.resourceType === "image" && (r.contentLength ?? 0) > LARGE_IMAGE_BYTES,
  }),
  pageIssue({
    key: "imageMissingDimensions",
    label: "Images missing width/height",
    group: "technical",
    tone: "warn",
    section: "Performance",
    test: (p) => p.imagesMissingDimensions > 0,
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
    key: "jsChangesTitle",
    label: "JavaScript changes the title",
    group: "technical",
    tone: "warn",
    section: "JavaScript",
    test: jsChangesTitle,
  }),
  pageIssue({
    key: "jsChangesCanonical",
    label: "JavaScript changes the canonical",
    group: "indexing",
    tone: "bad",
    section: "JavaScript",
    test: jsChangesCanonical,
  }),
  pageIssue({
    key: "jsChangesRobots",
    label: "JavaScript changes meta robots",
    group: "indexing",
    tone: "bad",
    section: "JavaScript",
    test: jsChangesRobots,
  }),
  pageIssue({
    key: "jsAddsMostContent",
    label: `Most content added by JavaScript (raw under ${JS_RAW_WORD_RATIO * 100}% of words)`,
    group: "content",
    tone: "warn",
    section: "JavaScript",
    test: jsAddsMostContent,
  }),
  pageIssue({
    key: "jsAddsLinks",
    label: `JavaScript adds internal links (over ${JS_ADDED_LINKS_THRESHOLD})`,
    group: "links",
    tone: "warn",
    section: "JavaScript",
    test: jsAddsLinks,
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
    key: "mixedContent",
    label: "Mixed content",
    group: "technical",
    tone: "bad",
    section: "Security",
    test: (p) => p.url.startsWith("https:") && p.mixedContentCount > 0,
  }),
  pageIssue({
    key: "missingCsp",
    label: "Missing CSP",
    group: "technical",
    tone: "warn",
    section: "Security",
    test: (p) => hasSecurityHeaders(p) && isBlank(p.contentSecurityPolicy),
  }),
  pageIssue({
    key: "missingFrameOptions",
    label: "Missing X-Frame-Options",
    group: "technical",
    tone: "warn",
    section: "Security",
    test: (p) => hasSecurityHeaders(p) && !hasFrameProtection(p),
  }),
  pageIssue({
    key: "missingContentTypeOptions",
    label: "Missing X-Content-Type-Options",
    group: "technical",
    tone: "warn",
    section: "Security",
    test: (p) => hasSecurityHeaders(p) && p.xContentTypeOptions?.trim().toLowerCase() !== "nosniff",
  }),
  pageIssue({
    key: "missingReferrerPolicy",
    label: "Missing Referrer-Policy",
    group: "technical",
    tone: "warn",
    section: "Security",
    test: (p) => hasSecurityHeaders(p) && isBlank(p.referrerPolicy),
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
    key: "hreflangMissingReturn",
    label: "Hreflang missing return link",
    group: "indexing",
    tone: "warn",
    section: "International",
    test: (p, ctx) => ctx.hreflangMissingReturn.has(p.url),
  }),
  pageIssue({
    key: "hreflangMissingSelf",
    label: "Hreflang missing self-reference",
    group: "indexing",
    tone: "warn",
    section: "International",
    test: (p) => hreflangFlags(p).missingSelf,
  }),
  pageIssue({
    key: "hreflangMissingXDefault",
    label: "Hreflang missing x-default",
    group: "indexing",
    section: "International",
    test: (p) => hreflangFlags(p).missingXDefault,
  }),
  pageIssue({
    key: "hreflangInvalidCode",
    label: "Invalid hreflang code",
    group: "indexing",
    tone: "bad",
    section: "International",
    test: (p) => hreflangFlags(p).invalidCode,
  }),
  pageIssue({
    key: "hreflangTargetError",
    label: "Hreflang to non-200/non-indexable",
    group: "indexing",
    tone: "bad",
    section: "International",
    test: (p, ctx) => ctx.hreflangTargetError.has(p.url),
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

/** Which side of a custom search rule a filter shows: pages with at least one match, or
 * searched pages with none ("does not contain"). */
export type CustomSearchMode = "contains" | "missing";

/** Dynamic filter key of one custom search rule, `custom:<id>:contains|missing`. */
export type CustomSearchFilterKey = `custom:${string}:${CustomSearchMode}`;

/** Status buckets, every registry issue, and the custom search filters. */
export type FilterKey = "all" | "2xx" | "3xx" | IssueKey | CustomSearchFilterKey;

export function customSearchFilterKey(id: string, mode: CustomSearchMode): CustomSearchFilterKey {
  return `custom:${id}:${mode}`;
}

/** The rule id and mode of a custom search filter key, or null for any other key. */
export function parseCustomSearchFilter(key: FilterKey): { id: string; mode: CustomSearchMode } | null {
  if (!key.startsWith("custom:")) return null;
  const sep = key.lastIndexOf(":");
  const mode = key.slice(sep + 1);
  const id = key.slice("custom:".length, sep);
  if (sep < "custom:".length || id === "" || (mode !== "contains" && mode !== "missing")) return null;
  return { id, mode };
}

/** Whether a page is on the `mode` side of custom search rule `id`. A page the rule never
 * ran on (non-HTML, blocked, errored, or crawled before the rule existed) has no count and
 * matches neither side. */
export function matchesCustomSearch(page: PageResult, id: string, mode: CustomSearchMode): boolean {
  const count = page.customSearchCounts[id] as number | undefined;
  if (count === undefined) return false;
  return mode === "contains" ? count > 0 : count === 0;
}

/** Running "contains" / "does not contain" page counts per custom search rule id, in the
 * order ids were first seen. Built incrementally in `App.tsx` so the Overview never rescans
 * every page per flush. */
export interface CustomSearchTracker {
  counts: Map<string, { contains: number; missing: number }>;
}

export function createCustomSearchTracker(): CustomSearchTracker {
  return { counts: new Map() };
}

export function ingestCustomSearchPage(tracker: CustomSearchTracker, page: PageResult): void {
  for (const [id, count] of Object.entries(page.customSearchCounts)) {
    let entry = tracker.counts.get(id);
    if (!entry) {
      entry = { contains: 0, missing: 0 };
      tracker.counts.set(id, entry);
    }
    if (count > 0) entry.contains++;
    else entry.missing++;
  }
}

export function getCustomSearchTracker(pages: PageResult[]): CustomSearchTracker {
  const tracker = createCustomSearchTracker();
  for (const p of pages) ingestCustomSearchPage(tracker, p);
  return tracker;
}

/** One custom search rule as the Overview and the Pages table show it. */
export interface CustomSearchStat {
  id: string;
  label: string;
  contains: number;
  missing: number;
}

function ruleLabel(rule: CustomSearchRule): string {
  return rule.name.trim() || rule.pattern.trim() || rule.id;
}

/**
 * The custom search rules to show for the results on screen: the rules the crawl ran with
 * (`crawlRules`, in order, even before any page has a count; for a loaded crawl, the rules
 * saved in its snapshot), then any other rule id found on the pages (a crawl saved before
 * snapshots stored rules), labelled with the bare id. Names are never borrowed from the
 * options sheet: a rule there with the same id may count something else.
 */
export function getCustomSearchStats(
  tracker: CustomSearchTracker,
  crawlRules: readonly CustomSearchRule[],
): CustomSearchStat[] {
  const stats: CustomSearchStat[] = [];
  const seen = new Set<string>();
  const push = (id: string, label: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const counts = tracker.counts.get(id) ?? { contains: 0, missing: 0 };
    stats.push({ id, label, contains: counts.contains, missing: counts.missing });
  };
  for (const rule of crawlRules) {
    if (rule.pattern.trim() !== "") push(rule.id, ruleLabel(rule));
  }
  for (const id of tracker.counts.keys()) push(id, `Custom search ${id}`);
  return stats;
}

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
  if (parseCustomSearchFilter(filter)) return "pages";
  return getIssueDef(filter)?.scope === "resource" ? "resources" : "pages";
}

function statusClass(status: number | null): number | null {
  return status === null ? null : Math.floor(status / 100);
}

/** Pages matching `filter`. Resource-scope issues and "all" leave the page list unfiltered. */
export function filterPages(pages: PageResult[], filter: FilterKey, ctx: FilterContext): PageResult[] {
  if (filter === "2xx") return pages.filter((p) => statusClass(p.status) === 2);
  if (filter === "3xx") return pages.filter((p) => statusClass(p.status) === 3);
  const custom = parseCustomSearchFilter(filter);
  if (custom) return pages.filter((p) => matchesCustomSearch(p, custom.id, custom.mode));
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
