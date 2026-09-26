import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { ChevronDown, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompareView } from "@/components/CompareView";
import { UrlCombobox } from "@/components/url-combobox";
import { CrawlActions } from "@/components/crawl-actions";
import { CrawlOptionsSheet } from "@/components/crawl-options-sheet";
import { CrawlModeToggle, ListModeDialog, type CrawlMode } from "@/components/list-mode-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCrawlEvents } from "@/hooks/useCrawlEvents";
import { Overview } from "./components/Overview";
import { DataTable } from "./components/DataTable";
import { DetailModal } from "./components/DetailModal";
import { type CustomSearchColumn, buildPageColumns } from "./components/columns/pageColumns";
import { resourceColumns } from "./components/columns/resourceColumns";
import { SiteTree } from "./components/SiteTree";
import { SiteInfoPanel } from "./components/SiteInfoPanel";
import {
  DEFAULT_CONFIG,
  type CrawlConfig,
  type CrawlProgress,
  type CrawlSnapshot,
  type CustomSearchRule,
  type ExtractionRule,
  type PageResult,
  type ResourceResult,
  type SiteInfo,
} from "./types";
import {
  type CustomSearchStat,
  type FilterContext,
  type FilterKey,
  createCustomSearchTracker,
  createDuplicateTracker,
  firstH1,
  firstH2,
  filterPages,
  filterResources,
  filterTab,
  getCustomSearchStats,
  getMetaPixelWidth,
  getPageIssueKeys,
  getTitlePixelWidth,
  getResourceIssueKeys,
  ingestCustomSearchPage,
  ingestDuplicateValue,
  ingestNon200LinkSources,
  createHreflangTracker,
  ingestHreflangPage,
  searchPages,
  searchResources,
} from "./lib/filters";
import {
  type LinkGraph,
  MAX_LINK_ROWS,
  addPageToLinkGraph,
  createLinkGraph,
  getInlinkCount,
  getInlinks,
  getUniqueInlinkCount,
  linkScore,
} from "./lib/linkGraph";
import { createNearDuplicateTracker, getNearDuplicateClusters, ingestNearDuplicatePage } from "./lib/nearDuplicates";
import { ISSUE_SOLUTIONS } from "./lib/issueSolutions";
import { buildIssueSummaryCsv, buildIssuesCsv } from "./lib/issueExport";
import { MAX_LIST_URLS, parseUrlList, withScheme } from "./lib/url";
import { activeCustomSearches, mergeCustomSearchRules, reconcileCustomSearchIds } from "./lib/customSearch";
import {
  type ExtractionColumn,
  activeExtractions,
  extractedCell,
  getExtractionColumns,
  ingestExtractionIds,
  mergeExtractionRules,
  reconcileExtractionIds,
} from "./lib/extraction";

type Tab = "overview" | "pages" | "resources" | "sitemap" | "compare";

/** How often link scores are recomputed while a crawl is running. PageRank is a whole-graph
 * computation, so it is not redone on every ~150 ms flush of new pages. */
const LINK_SCORE_INTERVAL_MS = 2000;

/**
 * `value` itself while `throttle` is false; while it is true, the latest `value` sampled at
 * most once every `intervalMs`.
 */
function useThrottledValue<T>(value: T, throttle: boolean, intervalMs: number): T {
  const [sampled, setSampled] = useState(value);
  const [wasThrottling, setWasThrottling] = useState(throttle);
  // When throttling turns on, start from the current value rather than whatever was sampled
  // during the previous throttled stretch (a previous crawl). Adjusting state while rendering
  // is React's documented pattern for resetting state when a prop changes.
  if (throttle !== wasThrottling) {
    setWasThrottling(throttle);
    if (throttle) setSampled(value);
  }
  const latestRef = useRef(value);
  useEffect(() => {
    latestRef.current = value;
  }, [value]);
  useEffect(() => {
    if (!throttle) return;
    const id = window.setInterval(() => setSampled(latestRef.current), intervalMs);
    return () => window.clearInterval(id);
  }, [throttle, intervalMs]);
  return throttle && wasThrottling ? sampled : value;
}

/** Where the crawl results on screen came from (see `shownSource` in `App`). */
interface CrawlSource {
  startUrl: string;
  listMode: boolean;
  /** Custom search rules the crawl ran with (for a loaded crawl, the rules saved with it). */
  customSearches: CustomSearchRule[];
  /** Custom extraction rules the crawl ran with (for a loaded crawl, the rules saved with it). */
  extractions: ExtractionRule[];
}

function App() {
  const [config, setConfig] = useState<CrawlConfig>(DEFAULT_CONFIG);
  const [pages, setPages] = useState<PageResult[]>([]);
  const [resources, setResources] = useState<ResourceResult[]>([]);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedPage, setSelectedPage] = useState<PageResult | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceResult | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [linkedUrls, setLinkedUrls] = useState<string[]>([]);
  // Which scheme to assume for a start URL typed without one (e.g. "example.com") — a
  // URL that already specifies http:// or https:// is never overridden by this.
  const [preferHttps, setPreferHttps] = useState(true);
  // Spider follows links from `config.startUrl`; List crawls exactly the URLs in `listText`.
  const [crawlMode, setCrawlMode] = useState<CrawlMode>("spider");
  const [listText, setListText] = useState("");
  // Deferred so re-parsing a very long pasted list never blocks typing in the dialog.
  const deferredListText = useDeferredValue(listText);
  const parsedList = useMemo(() => parseUrlList(deferredListText), [deferredListText]);
  // Where the results on screen came from: the start URL they are saved under (the first
  // listed URL in list mode) and whether they are a list crawl. Kept apart from `config`
  // so a list crawl never overwrites the Spider start URL box.
  const [shownSource, setShownSource] = useState<CrawlSource>({
    startUrl: "",
    listMode: false,
    customSearches: [],
    extractions: [],
  });
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
  // Mirrors the state the close-confirmation handler below needs, so that handler
  // (registered once on mount) always reads current values instead of a stale closure.
  const closeGuardRef = useRef({ running: false, pagesCount: 0, resourcesCount: 0 });
  // The start URL a stopped-but-unfinished crawl can be continued for (the backend keeps
  // the matching frontier around — see AppState.resume_state). Cleared whenever a crawl
  // finishes normally or a snapshot is loaded, so Start only continues when it's the same
  // crawl that was stopped, never a stale one.
  const [resumableStartUrl, setResumableStartUrl] = useState<string | null>(null);
  // Always the start URL of whichever crawl most recently started, read by the
  // `crawl://done` listener below (registered once on mount) instead of `config.startUrl`,
  // which would otherwise be a stale closure from that first render.
  const activeStartUrlRef = useRef<string | null>(null);

  const { discardPending } = useCrawlEvents({
    setPages,
    setResources,
    setSiteInfo,
    setProgress,
    setPaused,
    setRunning,
    setLinkedUrls,
    setResumableStartUrl,
    activeStartUrlRef,
  });

  useEffect(() => {
    closeGuardRef.current = { running, pagesCount: pages.length, resourcesCount: resources.length };
  }, [running, pages.length, resources.length]);

  // The results currently on screen, so handleStart can put them back if the backend
  // rejects the start (e.g. an invalid include/exclude pattern) after the view was cleared.
  const shownCrawlRef = useRef({ pages, resources, siteInfo, linkedUrls, progress });
  useEffect(() => {
    shownCrawlRef.current = { pages, resources, siteInfo, linkedUrls, progress };
  }, [pages, resources, siteInfo, linkedUrls, progress]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const fn = await getCurrentWindow().onCloseRequested(async (event) => {
        const { running, pagesCount, resourcesCount } = closeGuardRef.current;
        if (!running && pagesCount === 0 && resourcesCount === 0) return;

        const message = running
          ? "A crawl is currently running. Quitting now will stop it and lose progress. Quit anyway?"
          : "You have crawl results that haven't been saved. Quit anyway?";
        const confirmed = await ask(message, { title: "Quit Scary Spider SEO?", kind: "warning" });
        if (!confirmed) {
          event.preventDefault();
        }
      });
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleStart = useCallback(async () => {
    const listMode = crawlMode === "list";
    // Parsed here rather than read from `parsedList`, which may lag behind the text.
    const listUrls = listMode ? parseUrlList(listText).valid : [];
    if (listMode && listUrls.length === 0) {
      toast.error("Paste at least one http:// or https:// URL to crawl in list mode.");
      return;
    }
    if (listUrls.length > MAX_LIST_URLS) {
      toast.error(
        `List mode accepts at most ${MAX_LIST_URLS.toLocaleString()} URLs; this list has ${listUrls.length.toLocaleString()}.`,
      );
      return;
    }
    // A URL typed without a scheme (e.g. "example.com") gets the checkbox's preferred
    // one; a URL that already specifies http:// or https:// is left untouched. In list
    // mode the first listed URL stands in as the start URL (site info, saved crawls).
    const startUrl = listMode ? listUrls[0] : withScheme(config.startUrl, preferHttps);
    // Continuing a crawl stopped with URLs still queued (the backend kept its frontier
    // for this exact start URL — see AppState.resume_state): keep the results gathered
    // so far instead of wiping them, since the backend will append to them, not replace
    // them. A different start URL (or a crawl that ran to completion) always starts fresh.
    // List mode never continues: the backend neither stores nor consumes resume state
    // for it, and discards a spider crawl's leftover state when a list crawl starts.
    const continuing = !listMode && resumableStartUrl === startUrl;
    // A continued crawl already has counts under the earlier rules' ids: a rule edited since
    // then gets a fresh id (written back to the sheet) so one id never means two searches,
    // and the earlier rules stay known so their columns keep their names.
    const active = activeCustomSearches(config.customSearches);
    const { rules: customSearches, renamed } = continuing
      ? reconcileCustomSearchIds(active, shownSource.customSearches)
      : { rules: active, renamed: new Map<string, string>() };
    const shownCustomSearches = continuing
      ? mergeCustomSearchRules(shownSource.customSearches, customSearches)
      : customSearches;
    // Extraction rules follow the same rule: an edited rule gets a fresh id on continue.
    const activeExtraction = activeExtractions(config.extractions);
    const { rules: extractions, renamed: renamedExtractions } = continuing
      ? reconcileExtractionIds(activeExtraction, shownSource.extractions)
      : { rules: activeExtraction, renamed: new Map<string, string>() };
    const shownExtractions = continuing ? mergeExtractionRules(shownSource.extractions, extractions) : extractions;
    // Only sent to the backend: `config` keeps the Spider box's URL and no list.
    const nextConfig = { ...config, startUrl, listUrls, customSearches, extractions };
    if (renamed.size > 0 || renamedExtractions.size > 0) {
      const withNewId = <T extends { id: string }>(rules: T[], ids: Map<string, string>) =>
        rules.map((r) => {
          const id = ids.get(r.id);
          return id ? { ...r, id } : r;
        });
      setConfig((c) => ({
        ...c,
        customSearches: withNewId(c.customSearches, renamed),
        extractions: withNewId(c.extractions, renamedExtractions),
      }));
    }
    activeStartUrlRef.current = startUrl;
    // Cleared up front rather than after `invoke` resolves, because crawl events can
    // arrive before it does; restored below if the backend rejects the start.
    const previous = shownCrawlRef.current;
    const previousSource = shownSource;
    setShownSource({ startUrl, listMode, customSearches: shownCustomSearches, extractions: shownExtractions });
    if (!continuing) {
      setPages([]);
      setResources([]);
      setSiteInfo(null);
      setLinkedUrls([]);
      resetDerivedTrackers();
      discardPending();
    }
    if (!listMode) setConfig((c) => ({ ...c, startUrl }));
    setProgress(null);
    setFilter("all");
    setPaused(false);
    setRunning(true);
    try {
      await invoke("start_crawl", { config: nextConfig });
    } catch (err) {
      toast.error(String(err));
      setRunning(false);
      // A rejected start leaves the backend's results and resume state untouched, so the
      // view must match it again. Resetting the trackers makes them re-ingest every
      // restored page on the next derivation.
      setProgress(previous.progress);
      setShownSource(previousSource);
      if (!continuing) {
        resetDerivedTrackers();
        setPages(previous.pages);
        setResources(previous.resources);
        setSiteInfo(previous.siteInfo);
        setLinkedUrls(previous.linkedUrls);
      }
    }
  }, [config, crawlMode, listText, preferHttps, resumableStartUrl, shownSource, resetDerivedTrackers, discardPending]);

  const handleStop = useCallback(async () => {
    try {
      await invoke("stop_crawl");
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handlePause = useCallback(async () => {
    setPaused(true);
    try {
      await invoke("pause_crawl");
    } catch (err) {
      toast.error(String(err));
      setPaused(false);
    }
  }, []);

  const handleResume = useCallback(async () => {
    setPaused(false);
    try {
      await invoke("resume_crawl");
    } catch (err) {
      toast.error(String(err));
      setPaused(true);
    }
  }, []);

  const handleExport = useCallback(async (what: "pages" | "resources" | "links") => {
    try {
      const path = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: `${what}-export.csv`,
      });
      if (!path) return;
      await invoke("export_csv", {
        path,
        what,
        customSearches: shownSource.customSearches,
        extractions: shownSource.extractions,
      });
    } catch (err) {
      toast.error(String(err));
    }
  }, [shownSource.customSearches, shownSource.extractions]);

  const handleSaveCrawl = useCallback(async () => {
    try {
      const path = await save({
        filters: [{ name: "Scary Spider SEO Crawl", extensions: ["json"] }],
        defaultPath: "crawl.json",
      });
      if (!path) return;
      await invoke("save_crawl", {
        path,
        startUrl: shownSource.startUrl || config.startUrl,
        customSearches: shownSource.customSearches,
        extractions: shownSource.extractions,
      });
    } catch (err) {
      toast.error(String(err));
    }
  }, [shownSource.startUrl, shownSource.customSearches, shownSource.extractions, config.startUrl]);

  const handleOpenCrawl = useCallback(async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Scary Spider SEO Crawl", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return;
      const snapshot = await invoke<CrawlSnapshot>("load_crawl", { path });
      resetDerivedTrackers();
      setResumableStartUrl(null);
      setPages(snapshot.pages);
      setResources(snapshot.resources);
      setProgress(null);
      setRunning(false);
      setFilter("all");
      setConfig((prev) => ({ ...prev, startUrl: snapshot.startUrl }));
      // Saved crawls don't record their mode; they are classified as spider crawls.
      // Rules come from the snapshot only (empty before T3.3 and T3.4), never from the options sheet.
      setShownSource({
        startUrl: snapshot.startUrl,
        listMode: false,
        customSearches: snapshot.customSearches ?? [],
        extractions: snapshot.extractions ?? [],
      });
    } catch (err) {
      toast.error(String(err));
    }
  }, [resetDerivedTrackers]);

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
      listMode: shownSource.listMode,
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
      shownSource.listMode,
    ],
  );
  // Link scores rank the whole graph, so while a crawl runs they refresh on a timer instead
  // of on every flush; once it stops they follow the graph directly.
  const scoredLinkGraph = useThrottledValue(linkGraph, running, LINK_SCORE_INTERVAL_MS);
  const linkScores = useMemo(() => linkScore(scoredLinkGraph), [scoredLinkGraph]);
  const filteredPages = useMemo(
    () => searchPages(filterPages(pages, filter, filterContext), search),
    [pages, filter, search, filterContext],
  );
  const filteredResources = useMemo(
    () => searchResources(filterResources(resources, filter, filterContext), search),
    [resources, filter, search, filterContext],
  );

  // Issue exports are classified here (the frontend owns classification); the backend only
  // writes the finished text to disk.
  const handleExportIssues = useCallback(
    async (kind: "issues" | "summary") => {
      try {
        const path = await save({
          filters: [{ name: "CSV", extensions: ["csv"] }],
          defaultPath: kind === "issues" ? "issues-export.csv" : "issues-summary.csv",
        });
        if (!path) return;
        const contents =
          kind === "issues"
            ? buildIssuesCsv(pages, resources, filterContext)
            : buildIssueSummaryCsv(pages, resources, filterContext);
        await invoke("save_text_file", { path, contents });
      } catch (err) {
        toast.error(String(err));
      }
    },
    [pages, resources, filterContext],
  );

  // Rules of the crawl on screen (live or from its snapshot), plus rule ids only found on its
  // pages (a crawl saved before snapshots stored rules), labelled with the bare id.
  const customSearchStats = useMemo<CustomSearchStat[]>(
    () => getCustomSearchStats(customSearchTracker, shownSource.customSearches),
    [customSearchTracker, shownSource.customSearches],
  );
  // Keyed on ids and labels only, so the columns are not rebuilt on every count change.
  const customSearchColumnsKey = JSON.stringify(customSearchStats.map((s) => [s.id, s.label]));
  const customSearchColumns = useMemo<CustomSearchColumn[]>(
    () => customSearchStats.map(({ id, label }) => ({ id, label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed only when ids or labels change
    [customSearchColumnsKey],
  );
  // Rules of the crawl on screen, plus rule ids only found on its pages. Keyed on ids and labels
  // only, so the columns are not rebuilt on every flush.
  const extractionColumnsKey = JSON.stringify(getExtractionColumns(extractionIds, shownSource.extractions));
  const extractionColumns = useMemo<ExtractionColumn[]>(
    () => JSON.parse(extractionColumnsKey) as ExtractionColumn[],
    [extractionColumnsKey],
  );
  const pageColumns = useMemo(
    () => buildPageColumns(filterContext, linkScores, customSearchColumns, extractionColumns),
    [filterContext, linkScores, customSearchColumns, extractionColumns],
  );

  const selectedPageLinks = useMemo(
    () =>
      selectedPage
        ? {
            inlinks: getInlinks(linkGraph, selectedPage.url, MAX_LINK_ROWS),
            inlinkTotal: getInlinkCount(linkGraph, selectedPage.url),
            outlinks: selectedPage.outlinks,
          }
        : undefined,
    [selectedPage, linkGraph],
  );

  const selectedPageIssues = useMemo(() => {
    if (!selectedPage) return [];
    return getPageIssueKeys(selectedPage, filterContext)
      .map((key) => ISSUE_SOLUTIONS[key]);
  }, [selectedPage, filterContext]);

  const selectedResourceIssues = useMemo(() => {
    if (!selectedResource) return [];
    return getResourceIssueKeys(selectedResource, filterContext)
      .map((key) => ISSUE_SOLUTIONS[key]);
  }, [selectedResource, filterContext]);

  const handleSelectFilter = useCallback((next: FilterKey) => {
    setFilter((prev) => {
      const resolved = prev === next ? "all" : next;
      const targetTab = filterTab(resolved);
      if (targetTab) setTab(targetTab);
      return resolved;
    });
  }, []);

  const handleViewInPages = useCallback((query: string) => {
    setTab("pages");
    setFilter("all");
    setSearch(query);
  }, []);

  const exportTab: "pages" | "resources" = tab === "resources" ? "resources" : "pages";
  const exportCount = exportTab === "resources" ? resources.length : pages.length;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-2.5 border-b-[3px]! border-(--comic-ink)! bg-card px-4 py-2">
        <h1>
          <img src="/logo-wordmark.png" alt="Scary Spider SEO" className="h-24 w-auto" />
        </h1>
        <CrawlModeToggle mode={crawlMode} disabled={running} onChange={setCrawlMode} />
        {crawlMode === "list" ? (
          <ListModeDialog text={listText} parsed={parsedList} disabled={running} onTextChange={setListText} />
        ) : (
          <UrlCombobox
            value={config.startUrl}
            disabled={running}
            onChange={(startUrl) => setConfig((c) => ({ ...c, startUrl }))}
            onSubmit={handleStart}
            preferHttps={preferHttps}
            onToggleScheme={() => setPreferHttps((v) => !v)}
          />
        )}
        <CrawlActions
          running={running}
          paused={paused}
          canStart={crawlMode === "list" ? parsedList.valid.length > 0 : !!config.startUrl}
          continuing={crawlMode === "spider" && resumableStartUrl === config.startUrl}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
        />
        <CrawlOptionsSheet config={config} running={running} listMode={crawlMode === "list"} onChange={setConfig} />
        <div className="flex-1" />
        <ThemeToggle />
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setFilter("all");
          setSearch("");
        }}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4"
      >
        <div className="flex items-center gap-2.5">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pages">Pages ({pages.length})</TabsTrigger>
            <TabsTrigger value="resources">Links & Images ({resources.length})</TabsTrigger>
            <TabsTrigger value="sitemap">Site Map</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>
          {filter !== "all" && (
            <Badge variant="secondary" className="h-auto gap-1.5 py-1">
              Filtered
              <button
                type="button"
                className="ml-0.5 hover:text-foreground"
                onClick={() => setFilter("all")}
                aria-label="Clear filter"
              >
                ×
              </button>
            </Badge>
          )}
          {(tab === "pages" || tab === "resources") && (
            <InputGroup className="w-64">
              <InputGroupAddon>
                <SearchIcon className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder={`Search ${tab === "pages" ? "pages" : "links & images"}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleOpenCrawl} disabled={running}>
            Open Crawl…
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveCrawl}
            disabled={pages.length === 0 && resources.length === 0}
          >
            Save Crawl…
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport(exportTab)} disabled={exportCount === 0}>
            Export {exportTab === "pages" ? "Pages" : "Resources"} CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={pages.length === 0 && resources.length === 0}>
                Export Issues
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => handleExportIssues("issues")}>Export issues…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExportIssues("summary")}>Export issue summary…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport("links")}>Export all internal links…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-4 overflow-y-auto">
          {siteInfo && <SiteInfoPanel siteInfo={siteInfo} />}
          <Overview
            pages={pages}
            resources={resources}
            filterContext={filterContext}
            progress={progress}
            running={running}
            paused={paused}
            activeFilter={filter}
            onSelectFilter={handleSelectFilter}
            customSearches={customSearchStats}
          />
        </TabsContent>

        <TabsContent value="pages" className="min-h-0 flex-1">
          <DataTable
            data={filteredPages}
            columns={pageColumns}
            emptyLabel="No pages crawled yet. Start a crawl above."
            onRowClick={setSelectedPage}
            storageKey="pages"
          />
        </TabsContent>

        <TabsContent value="resources" className="min-h-0 flex-1">
          <DataTable
            data={filteredResources}
            columns={resourceColumns}
            emptyLabel="No external links or images checked yet."
            onRowClick={setSelectedResource}
            storageKey="resources"
          />
        </TabsContent>

        <TabsContent value="sitemap" className="min-h-0 flex-1">
          <SiteTree
            pages={pages}
            filterContext={filterContext}
            onSelectPage={setSelectedPage}
            onViewInPages={handleViewInPages}
          />
        </TabsContent>

        {/* Kept mounted so the chosen files and results survive switching tabs. It reads its
            own crawl files and never touches the crawl on screen. */}
        <TabsContent value="compare" forceMount className="min-h-0 flex-1 flex-col data-[state=active]:flex data-[state=inactive]:hidden">
          <CompareView />
        </TabsContent>
      </Tabs>

      {selectedPage && (
        <DetailModal
          title={selectedPage.url}
          onClose={() => setSelectedPage(null)}
          issues={selectedPageIssues}
          links={selectedPageLinks}
          fields={[
            { label: "URL", value: selectedPage.url },
            { label: "Status", value: selectedPage.status },
            { label: "Status Text", value: selectedPage.statusText },
            { label: "Indexability", value: selectedPage.indexability },
            { label: "Error", value: selectedPage.error, isError: true },
            { label: "Redirect URL", value: selectedPage.redirectUrl },
            { label: "Title", value: selectedPage.title },
            { label: "Title Length", value: selectedPage.titleLength },
            { label: "Title Width (px)", value: selectedPage.title ? getTitlePixelWidth(selectedPage) : null },
            { label: "Meta Description", value: selectedPage.metaDescription },
            { label: "Meta Description Length", value: selectedPage.metaDescriptionLength },
            { label: "Meta Description Width (px)", value: selectedPage.metaDescription ? getMetaPixelWidth(selectedPage) : null },
            { label: "H1", value: selectedPage.h1 },
            { label: "H1 Count", value: selectedPage.h1Count },
            { label: "Word Count", value: selectedPage.wordCount },
            ...customSearchColumns.map(({ id, label }) => ({
              label: `Custom search: ${label}`,
              value: selectedPage.customSearchCounts[id] ?? null,
            })),
            ...extractionColumns.map(({ id, label }) => ({
              label: `Extraction: ${label}`,
              value: extractedCell(selectedPage, id),
            })),
            { label: "Canonical", value: selectedPage.canonical },
            { label: "Meta Robots", value: selectedPage.metaRobots },
            { label: "Content Type", value: selectedPage.contentType },
            { label: "Response Time (ms)", value: selectedPage.responseTimeMs },
            { label: "Inlinks", value: getInlinkCount(linkGraph, selectedPage.url) },
            { label: "Unique Inlinks", value: getUniqueInlinkCount(linkGraph, selectedPage.url) },
            { label: "Link Score", value: linkScores.get(selectedPage.url) ?? null },
            { label: "Internal Links", value: selectedPage.internalLinkCount },
            { label: "External Links", value: selectedPage.externalLinkCount },
            { label: "Images", value: selectedPage.imageCount },
            { label: "Size (bytes)", value: selectedPage.htmlSizeBytes },
            { label: "Minified", value: selectedPage.htmlSizeBytes ? (selectedPage.isMinified ? "Yes" : "No") : null },
            {
              label: "Minify Savings",
              value: selectedPage.htmlSizeBytes ? `${selectedPage.minifySavingsPct.toFixed(0)}%` : null,
            },
            { label: "Depth", value: selectedPage.depth },
            { label: "JS Rendered", value: selectedPage.rendered ? "Yes" : "No" },
            // Raw (pre-JavaScript) values, only for pages compared with "Compare raw and rendered HTML".
            ...(selectedPage.raw
              ? [
                  { label: "Raw Title", value: selectedPage.raw.title },
                  { label: "Raw Canonical", value: selectedPage.raw.canonical },
                  { label: "Raw Meta Robots", value: selectedPage.raw.metaRobots },
                  { label: "Raw Word Count", value: selectedPage.raw.wordCount },
                  { label: "Raw Internal Links", value: selectedPage.raw.internalLinkCount },
                ]
              : []),
            {
              label: "HSTS",
              value: selectedPage.url.startsWith("https:") ? (selectedPage.hsts ? "Yes" : "No") : null,
            },
            { label: "Insecure Links", value: selectedPage.insecureLinkCount },
            { label: "Missing Alt Images", value: selectedPage.missingAltCount },
            { label: "Lang Attribute", value: selectedPage.htmlSizeBytes ? selectedPage.lang : null },
            {
              label: "Hreflang",
              value: selectedPage.hreflangValues.length > 0 ? selectedPage.hreflangValues.join(", ") : null,
            },
            { label: "Internal Nofollow Links", value: selectedPage.internalNofollowCount },
            {
              label: "Text/HTML Ratio",
              value: selectedPage.htmlSizeBytes ? `${selectedPage.textRatioPct.toFixed(1)}%` : null,
            },
            { label: "Content Simhash", value: selectedPage.contentSimhash || null },
            {
              label: "Near-Duplicate Cluster Size",
              value: filterContext.nearDuplicates.get(selectedPage.url)?.size ?? null,
            },
            { label: "X-Robots-Tag", value: selectedPage.xRobotsTag },
            { label: "Viewport", value: selectedPage.viewport },
            { label: "Open Graph Tags", value: selectedPage.hasOpenGraph ? "Yes" : "No" },
            { label: "Twitter Card Tags", value: selectedPage.hasTwitterCard ? "Yes" : "No" },
            { label: "Canonical Tag Count", value: selectedPage.canonicalCount },
            { label: "Discovered Via Sitemap", value: selectedPage.discoveredViaSitemap ? "Yes" : "No" },
            {
              label: "Redirect Chain",
              value: selectedPage.redirectChain.length > 0 ? selectedPage.redirectChain.join(" → ") : null,
            },
            {
              label: "Structured Data Types",
              value: selectedPage.structuredDataTypes.length > 0 ? selectedPage.structuredDataTypes.join(", ") : null,
            },
            {
              label: "Structured Data Errors",
              value: selectedPage.structuredDataErrors.length > 0 ? selectedPage.structuredDataErrors.join("; ") : null,
              isError: true,
            },
            {
              label: "Accessibility Violations",
              value:
                selectedPage.accessibilityViolations.length > 0
                  ? selectedPage.accessibilityViolations.map((v) => `${v.id} (${v.nodeCount} nodes)`).join("; ")
                  : null,
              isError: true,
            },
            {
              label: "Mobile Usability Violations",
              value:
                selectedPage.mobileUsabilityViolations.length > 0
                  ? selectedPage.mobileUsabilityViolations.map((v) => `${v.id} (${v.nodeCount} nodes)`).join("; ")
                  : null,
              isError: true,
            },
          ]}
        />
      )}

      {selectedResource && (
        <DetailModal
          title={selectedResource.url}
          onClose={() => setSelectedResource(null)}
          issues={selectedResourceIssues}
          fields={[
            { label: "URL", value: selectedResource.url },
            { label: "Type", value: selectedResource.resourceType },
            { label: "Status", value: selectedResource.status },
            { label: "Status Text", value: selectedResource.statusText },
            { label: "Source Page", value: selectedResource.sourcePage },
            { label: "Internal", value: selectedResource.isInternal ? "Yes" : "No" },
            { label: "Alt Text", value: selectedResource.altText },
            { label: "Insecure", value: selectedResource.isInsecure ? "Yes" : "No" },
            { label: "Error", value: selectedResource.error, isError: true },
          ]}
        />
      )}
    </div>
  );
}

export default App;
