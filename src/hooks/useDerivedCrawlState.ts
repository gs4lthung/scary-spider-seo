import { useCallback, useMemo, useRef } from "react";
import type { PageResult } from "@/types";
import type { FilterContext } from "@/lib/filters";
import {
  type DerivedCrawlState,
  buildFilterContext,
  createDerivedCrawlState,
  createDerivedTrackers,
  syncDerivedCrawlState,
} from "@/lib/derivedState";

/**
 * Everything derived from the crawled pages: the `FilterContext` every issue predicate
 * classifies against, plus the custom search counts and extraction rule ids seen on the
 * pages. Built incrementally from `pages` as it grows (see `syncDerivedCrawlState`); a
 * `pages` array that was replaced rather than appended to starts the trackers over, and
 * `resetDerivedTrackers` does so explicitly before a wholesale replacement.
 */
export function useDerivedCrawlState(pages: PageResult[], linkedUrls: string[], listMode: boolean) {
  const stateRef = useRef<DerivedCrawlState>(createDerivedCrawlState());

  const resetDerivedTrackers = useCallback(() => {
    stateRef.current = { version: stateRef.current.version + 1, trackers: createDerivedTrackers() };
  }, []);

  // Ingests only the pages not yet seen by the trackers (normally just the latest batch:
  // `pages` only grows by appending during a crawl) and hands out the trackers' live
  // collections with a new version, instead of rescanning or copying every page crawled so
  // far on every ~150ms UI flush. Consumers depend on `derived` (new per version).
  const derived = useMemo(() => {
    stateRef.current = syncDerivedCrawlState(stateRef.current, pages);
    return stateRef.current;
     
  }, [pages]);

  const linkedUrlSet = useMemo(() => new Set(linkedUrls), [linkedUrls]);
  // The one context every issue predicate classifies against (filters, Overview counts,
  // Issues column, site tree, detail modal). A new object per version, so memos keyed on it
  // recompute when the live collections it points at change.
  const filterContext = useMemo<FilterContext>(
    () => buildFilterContext(derived.trackers, linkedUrlSet, listMode),
    [derived, linkedUrlSet, listMode],
  );
  return {
    derived,
    filterContext,
    linkGraph: filterContext.linkGraph,
    extractionIds: derived.trackers.extractionIds,
    resetDerivedTrackers,
  };
}
