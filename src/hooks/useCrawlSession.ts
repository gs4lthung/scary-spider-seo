import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import type { CrawlMode } from "@/components/list-mode-dialog";
import type {
  CrawlConfig,
  CrawlProgress,
  CrawlSnapshot,
  CustomSearchRule,
  ExtractionRule,
  PageResult,
  ResourceResult,
  SiteInfo,
} from "@/types";
import type { FilterContext, FilterKey } from "@/lib/filters";
import { buildIssueSummaryCsv, buildIssuesCsv } from "@/lib/issueExport";
import { MAX_LIST_URLS, parseUrlList, withScheme } from "@/lib/url";
import { activeCustomSearches, mergeCustomSearchRules, reconcileCustomSearchIds } from "@/lib/customSearch";
import { activeExtractions, mergeExtractionRules, reconcileExtractionIds } from "@/lib/extraction";

/** Where the crawl results on screen came from (see `shownSource` in `App`). */
export interface CrawlSource {
  startUrl: string;
  listMode: boolean;
  /** Custom search rules the crawl ran with (for a loaded crawl, the rules saved with it). */
  customSearches: CustomSearchRule[];
  /** Custom extraction rules the crawl ran with (for a loaded crawl, the rules saved with it). */
  extractions: ExtractionRule[];
}

type Setter<T> = Dispatch<SetStateAction<T>>;

/** The crawl state `App` owns, with its setters, plus the helpers the handlers need. */
export interface CrawlSessionParams {
  config: CrawlConfig;
  setConfig: Setter<CrawlConfig>;
  crawlMode: CrawlMode;
  listText: string;
  preferHttps: boolean;
  pages: PageResult[];
  setPages: Setter<PageResult[]>;
  resources: ResourceResult[];
  setResources: Setter<ResourceResult[]>;
  progress: CrawlProgress | null;
  setProgress: Setter<CrawlProgress | null>;
  siteInfo: SiteInfo | null;
  setSiteInfo: Setter<SiteInfo | null>;
  linkedUrls: string[];
  setLinkedUrls: Setter<string[]>;
  running: boolean;
  setRunning: Setter<boolean>;
  setPaused: Setter<boolean>;
  setFilter: Setter<FilterKey>;
  shownSource: CrawlSource;
  setShownSource: Setter<CrawlSource>;
  resumableStartUrl: string | null;
  setResumableStartUrl: Setter<string | null>;
  activeStartUrlRef: RefObject<string | null>;
  filterContext: FilterContext;
  /** From `useDerivedCrawlState`: forget every ingested page before `pages` is replaced. */
  resetDerivedTrackers: () => void;
  /** From `useCrawlEvents`: drop buffered pages and resources not applied yet. */
  discardPending: () => void;
}

/**
 * The crawl command handlers (start, stop, pause, resume, export, save, open) and the
 * quit confirmation. Start keeps a stopped crawl's results when it continues it, and puts
 * the previous results back when the backend rejects the start.
 */
export function useCrawlSession({
  config,
  setConfig,
  crawlMode,
  listText,
  preferHttps,
  pages,
  setPages,
  resources,
  setResources,
  progress,
  setProgress,
  siteInfo,
  setSiteInfo,
  linkedUrls,
  setLinkedUrls,
  running,
  setRunning,
  setPaused,
  setFilter,
  shownSource,
  setShownSource,
  resumableStartUrl,
  setResumableStartUrl,
  activeStartUrlRef,
  filterContext,
  resetDerivedTrackers,
  discardPending,
}: CrawlSessionParams) {
  // Mirrors the state the close-confirmation handler below needs, so that handler
  // (registered once on mount) always reads current values instead of a stale closure.
  const closeGuardRef = useRef({ running: false, pagesCount: 0, resourcesCount: 0 });

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
    // The setters and the ref are stable; listed for the linter, they never retrigger this.
  }, [
    config,
    crawlMode,
    listText,
    preferHttps,
    resumableStartUrl,
    shownSource,
    resetDerivedTrackers,
    discardPending,
    activeStartUrlRef,
    setConfig,
    setFilter,
    setLinkedUrls,
    setPages,
    setPaused,
    setProgress,
    setResources,
    setRunning,
    setShownSource,
    setSiteInfo,
  ]);

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
  }, [setPaused]);

  const handleResume = useCallback(async () => {
    setPaused(false);
    try {
      await invoke("resume_crawl");
    } catch (err) {
      toast.error(String(err));
      setPaused(true);
    }
  }, [setPaused]);

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
  }, [
    resetDerivedTrackers,
    setConfig,
    setFilter,
    setPages,
    setProgress,
    setResources,
    setResumableStartUrl,
    setRunning,
    setShownSource,
  ]);

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

  return {
    handleStart,
    handleStop,
    handlePause,
    handleResume,
    handleExport,
    handleSaveCrawl,
    handleOpenCrawl,
    handleExportIssues,
  };
}
