import type { PageResult } from "../types";
import {
  type CustomSearchTracker,
  type DuplicateTracker,
  type FilterContext,
  type HreflangTracker,
  createCustomSearchTracker,
  createDuplicateTracker,
  createHreflangTracker,
  firstH1,
  firstH2,
  ingestCustomSearchPage,
  ingestDuplicateValue,
  ingestHreflangPage,
  ingestNon200LinkSources,
} from "./filters";
import { type LinkGraph, addPageToLinkGraph, createLinkGraph } from "./linkGraph";
import {
  type NearDuplicateCluster,
  type NearDuplicateTracker,
  createNearDuplicateTracker,
  getNearDuplicateClusters,
  ingestNearDuplicatePage,
} from "./nearDuplicates";
import { ingestExtractionIds } from "./extraction";

/**
 * Every incremental accumulator derived from the crawled pages, fed one page at a time so a
 * live crawl never rescans the pages it already has. The collections grow in place: readers
 * get them as they are, and `DerivedCrawlState.version` tells them when they changed.
 */
export interface DerivedTrackers {
  duplicateTitles: DuplicateTracker;
  duplicateContent: DuplicateTracker;
  duplicateMeta: DuplicateTracker;
  duplicateH1s: DuplicateTracker;
  duplicateH2s: DuplicateTracker;
  canonicalStatusMap: Map<string, number | null>;
  pageByUrl: Map<string, PageResult>;
  sitemapUsed: boolean;
  linkGraph: LinkGraph;
  non200LinkSources: Set<string>;
  hreflang: HreflangTracker;
  nearDuplicates: NearDuplicateTracker;
  customSearch: CustomSearchTracker;
  /** Custom extraction rule ids seen on the pages (at most one per rule). */
  extractionIds: Set<string>;
  /** How many pages of the current `pages` array have been ingested. */
  ingested: number;
  /** The last page ingested, to tell an appended-to `pages` array from a replaced one. */
  lastPage: PageResult | null;
}

/** The trackers plus a counter bumped on every change; memo dependencies use the version (or
 * the object, which is new per version) instead of copies of the collections. */
export interface DerivedCrawlState {
  version: number;
  trackers: DerivedTrackers;
}

export function createDerivedTrackers(): DerivedTrackers {
  return {
    duplicateTitles: createDuplicateTracker(),
    duplicateContent: createDuplicateTracker(),
    duplicateMeta: createDuplicateTracker(),
    duplicateH1s: createDuplicateTracker(),
    duplicateH2s: createDuplicateTracker(),
    canonicalStatusMap: new Map(),
    pageByUrl: new Map(),
    sitemapUsed: false,
    linkGraph: createLinkGraph(),
    non200LinkSources: new Set(),
    hreflang: createHreflangTracker(),
    nearDuplicates: createNearDuplicateTracker(),
    customSearch: createCustomSearchTracker(),
    extractionIds: new Set(),
    ingested: 0,
    lastPage: null,
  };
}

function ingestPage(t: DerivedTrackers, p: PageResult): void {
  ingestDuplicateValue(t.duplicateTitles, p.title);
  ingestDuplicateValue(t.duplicateContent, p.contentHash);
  ingestDuplicateValue(t.duplicateMeta, p.metaDescription);
  ingestDuplicateValue(t.duplicateH1s, firstH1(p));
  ingestDuplicateValue(t.duplicateH2s, firstH2(p));
  t.canonicalStatusMap.set(p.url, p.status);
  t.pageByUrl.set(p.url, p);
  if (p.discoveredViaSitemap) t.sitemapUsed = true;
  addPageToLinkGraph(t.linkGraph, p);
  ingestNon200LinkSources(t.non200LinkSources, t.linkGraph, t.pageByUrl, p);
  ingestHreflangPage(t.hreflang, t.pageByUrl, p);
  ingestNearDuplicatePage(t.nearDuplicates, p);
  ingestCustomSearchPage(t.customSearch, p);
  ingestExtractionIds(t.extractionIds, p);
}

/** Whether `pages` still starts with every page `t` has ingested, i.e. it was only appended to. */
export function isAppendOf(pages: readonly PageResult[], ingested: number, lastPage: PageResult | null): boolean {
  if (ingested > pages.length) return false;
  return ingested === 0 || pages[ingested - 1] === lastPage;
}

/**
 * Brings `state` up to date with `pages`, ingesting only the pages it has not seen. Returns
 * `state` itself when nothing changed, a new state with the next version when pages were
 * appended, and fresh trackers when `pages` was replaced rather than appended to.
 */
export function syncDerivedCrawlState(state: DerivedCrawlState, pages: readonly PageResult[]): DerivedCrawlState {
  let trackers = state.trackers;
  if (!isAppendOf(pages, trackers.ingested, trackers.lastPage)) trackers = createDerivedTrackers();
  if (trackers === state.trackers && trackers.ingested === pages.length) return state;
  for (let i = trackers.ingested; i < pages.length; i++) ingestPage(trackers, pages[i]);
  trackers.ingested = pages.length;
  trackers.lastPage = pages.length > 0 ? pages[pages.length - 1] : null;
  return { version: state.version + 1, trackers };
}

export function createDerivedCrawlState(): DerivedCrawlState {
  return { version: 0, trackers: createDerivedTrackers() };
}

/**
 * The `FilterContext` over the trackers' live collections (no copies). Near-duplicate clusters
 * are a snapshot of the union-find, O(pages) to build, so they are built on first read and
 * reused by every later read of this context. Build a new context per `DerivedCrawlState`
 * version; an older one keeps the clusters it read first.
 */
export function buildFilterContext(
  trackers: DerivedTrackers,
  linkedUrls: Set<string>,
  listMode: boolean,
): FilterContext {
  let nearDuplicates: Map<string, NearDuplicateCluster> | null = null;
  return {
    duplicateTitles: trackers.duplicateTitles.duplicates,
    duplicateContent: trackers.duplicateContent.duplicates,
    duplicateMeta: trackers.duplicateMeta.duplicates,
    duplicateH1s: trackers.duplicateH1s.duplicates,
    duplicateH2s: trackers.duplicateH2s.duplicates,
    canonicalStatusMap: trackers.canonicalStatusMap,
    linkedUrls,
    pageByUrl: trackers.pageByUrl,
    sitemapUsed: trackers.sitemapUsed,
    // A new wrapper per context, so consumers keyed on the graph see each change; the graph's
    // maps grow in place, so this is O(1), not a copy of every link.
    linkGraph: { ...trackers.linkGraph },
    non200LinkSources: trackers.non200LinkSources,
    hreflangMissingReturn: trackers.hreflang.missingReturn,
    hreflangTargetError: trackers.hreflang.targetError,
    get nearDuplicates() {
      nearDuplicates ??= getNearDuplicateClusters(trackers.nearDuplicates);
      return nearDuplicates;
    },
    listMode,
  };
}
