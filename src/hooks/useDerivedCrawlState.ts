import { useCallback, useMemo, useRef } from "react";
import type { PageResult } from "@/types";
import {
  type FilterContext,
  createCustomSearchTracker,
  createDuplicateTracker,
  createHreflangTracker,
  firstH1,
  firstH2,
  ingestCustomSearchPage,
  ingestDuplicateValue,
  ingestHreflangPage,
  ingestNon200LinkSources,
} from "@/lib/filters";
import { type LinkGraph, addPageToLinkGraph, createLinkGraph } from "@/lib/linkGraph";
import { createNearDuplicateTracker, getNearDuplicateClusters, ingestNearDuplicatePage } from "@/lib/nearDuplicates";
import { ingestExtractionIds } from "@/lib/extraction";

/**
 * Everything derived from the crawled pages: the `FilterContext` every issue predicate
 * classifies against, plus the custom search counts and extraction rule ids seen on the
 * pages. Built incrementally from `pages` as it grows; `resetDerivedTrackers` must be
 * called whenever `pages` is replaced wholesale rather than appended to.
 */
export function useDerivedCrawlState(pages: PageResult[], linkedUrls: string[], listMode: boolean) {
  // Backs the duplicate-title/meta/content and canonical-status derivations below with
  // incremental accumulators instead of full-array rescans (see the useMemo that reads
  // them for why). Reset via resetDerivedTrackers() whenever `pages` is replaced wholesale
  // rather than appended to.
  const titleTrackerRef = useRef(createDuplicateTracker());
  const contentTrackerRef = useRef(createDuplicateTracker());
  const metaTrackerRef = useRef(createDuplicateTracker());
  const h1TrackerRef = useRef(createDuplicateTracker());
  const h2TrackerRef = useRef(createDuplicateTracker());
  const canonicalStatusRef = useRef(new Map<string, number | null>());
  const pageByUrlRef = useRef(new Map<string, PageResult>());
  const sitemapUsedRef = useRef(false);
  const linkGraphRef = useRef(createLinkGraph());
  const non200LinkSourcesRef = useRef(new Set<string>());
  const hreflangTrackerRef = useRef(createHreflangTracker());
  const nearDuplicateTrackerRef = useRef(createNearDuplicateTracker());
  const customSearchTrackerRef = useRef(createCustomSearchTracker());
  const extractionIdsRef = useRef(new Set<string>());
  const ingestedPagesCountRef = useRef(0);

  const resetDerivedTrackers = useCallback(() => {
    titleTrackerRef.current = createDuplicateTracker();
    contentTrackerRef.current = createDuplicateTracker();
    metaTrackerRef.current = createDuplicateTracker();
    h1TrackerRef.current = createDuplicateTracker();
    h2TrackerRef.current = createDuplicateTracker();
    canonicalStatusRef.current = new Map();
    pageByUrlRef.current = new Map();
    sitemapUsedRef.current = false;
    linkGraphRef.current = createLinkGraph();
    non200LinkSourcesRef.current = new Set();
    hreflangTrackerRef.current = createHreflangTracker();
    nearDuplicateTrackerRef.current = createNearDuplicateTracker();
    customSearchTrackerRef.current = createCustomSearchTracker();
    extractionIdsRef.current = new Set();
    ingestedPagesCountRef.current = 0;
  }, []);
  // Ingests only the pages not yet seen by the trackers (normally just the latest batch —
  // `pages` only grows by appending during a crawl) instead of rescanning/rehashing every
  // page crawled so far on every ~150ms UI flush, which is what made this cost trend toward
  // O(n²) over a long crawl. Still produces fresh Set/Map instances each time so downstream
  // useMemo/props comparisons below see them exactly as before.
  const {
    duplicateTitleSet,
    duplicateContentSet,
    duplicateMetaSet,
    duplicateH1Set,
    duplicateH2Set,
    canonicalStatusMap,
    pageByUrl,
    sitemapUsed,
    linkGraph,
    non200LinkSources,
    hreflangMissingReturn,
    hreflangTargetError,
    nearDuplicates,
    customSearchTracker,
    extractionIds,
  } = useMemo(() => {
    if (ingestedPagesCountRef.current > pages.length) {
      // `pages` was replaced wholesale rather than appended to (defensive fallback —
      // handleStart/handleOpenCrawl already call resetDerivedTrackers() explicitly).
      resetDerivedTrackers();
    }
    for (let i = ingestedPagesCountRef.current; i < pages.length; i++) {
      const p = pages[i];
      ingestDuplicateValue(titleTrackerRef.current, p.title);
      ingestDuplicateValue(contentTrackerRef.current, p.contentHash);
      ingestDuplicateValue(metaTrackerRef.current, p.metaDescription);
      ingestDuplicateValue(h1TrackerRef.current, firstH1(p));
      ingestDuplicateValue(h2TrackerRef.current, firstH2(p));
      canonicalStatusRef.current.set(p.url, p.status);
      pageByUrlRef.current.set(p.url, p);
      if (p.discoveredViaSitemap) sitemapUsedRef.current = true;
      addPageToLinkGraph(linkGraphRef.current, p);
      ingestNon200LinkSources(non200LinkSourcesRef.current, linkGraphRef.current, pageByUrlRef.current, p);
      ingestHreflangPage(hreflangTrackerRef.current, pageByUrlRef.current, p);
      ingestNearDuplicatePage(nearDuplicateTrackerRef.current, p);
      ingestCustomSearchPage(customSearchTrackerRef.current, p);
      ingestExtractionIds(extractionIdsRef.current, p);
    }
    ingestedPagesCountRef.current = pages.length;

    return {
      duplicateTitleSet: new Set(titleTrackerRef.current.duplicates),
      duplicateContentSet: new Set(contentTrackerRef.current.duplicates),
      duplicateMetaSet: new Set(metaTrackerRef.current.duplicates),
      duplicateH1Set: new Set(h1TrackerRef.current.duplicates),
      duplicateH2Set: new Set(h2TrackerRef.current.duplicates),
      canonicalStatusMap: new Map(canonicalStatusRef.current),
      pageByUrl: new Map(pageByUrlRef.current),
      sitemapUsed: sitemapUsedRef.current,
      // A new wrapper per change (the graph's maps grow in place, which is O(new links)
      // rather than a copy of every link crawled so far).
      linkGraph: { ...linkGraphRef.current } satisfies LinkGraph,
      non200LinkSources: new Set(non200LinkSourcesRef.current),
      hreflangMissingReturn: new Set(hreflangTrackerRef.current.missingReturn),
      hreflangTargetError: new Set(hreflangTrackerRef.current.targetError),
      // O(pages) snapshot of the incrementally built clusters; no pairwise rescan.
      nearDuplicates: getNearDuplicateClusters(nearDuplicateTrackerRef.current),
      // At most one entry per rule (10), so a copy per flush is cheap.
      customSearchTracker: {
        counts: new Map([...customSearchTrackerRef.current.counts].map(([id, c]) => [id, { ...c }])),
      },
      // Rule ids seen on the pages (at most one per rule), for the extraction columns.
      extractionIds: [...extractionIdsRef.current],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trackers are refs, intentionally excluded
  }, [pages]);
  const linkedUrlSet = useMemo(() => new Set(linkedUrls), [linkedUrls]);
  // The one context every issue predicate classifies against (filters, Overview counts,
  // Issues column, site tree, detail modal).
  const filterContext = useMemo<FilterContext>(
    () => ({
      duplicateTitles: duplicateTitleSet,
      duplicateContent: duplicateContentSet,
      duplicateMeta: duplicateMetaSet,
      duplicateH1s: duplicateH1Set,
      duplicateH2s: duplicateH2Set,
      canonicalStatusMap,
      linkedUrls: linkedUrlSet,
      pageByUrl,
      sitemapUsed,
      linkGraph,
      non200LinkSources,
      hreflangMissingReturn,
      hreflangTargetError,
      nearDuplicates,
      listMode,
    }),
    [
      duplicateTitleSet,
      duplicateContentSet,
      duplicateMetaSet,
      duplicateH1Set,
      duplicateH2Set,
      canonicalStatusMap,
      linkedUrlSet,
      pageByUrl,
      sitemapUsed,
      linkGraph,
      non200LinkSources,
      hreflangMissingReturn,
      hreflangTargetError,
      nearDuplicates,
      listMode,
    ],
  );
  return { filterContext, linkGraph, customSearchTracker, extractionIds, resetDerivedTrackers };
}
