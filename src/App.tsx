import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { ChevronDown, SearchIcon, XIcon } from "lucide-react";
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
import { type CrawlSource, useCrawlSession } from "@/hooks/useCrawlSession";
import { useDerivedCrawlState } from "@/hooks/useDerivedCrawlState";
import { useThrottledValue } from "@/hooks/useThrottledValue";
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
  type PageResult,
  type ResourceResult,
  type SiteInfo,
} from "./types";
import {
  type CustomSearchStat,
  type FilterKey,
  filterPages,
  filterResources,
  filterTab,
  getCustomSearchStats,
  getMetaPixelWidth,
  getPageIssueKeys,
  getTitlePixelWidth,
  getResourceIssueKeys,
  searchPages,
  searchResources,
} from "./lib/filters";
import { MAX_LINK_ROWS, getInlinkCount, getInlinks, getUniqueInlinkCount, linkScore } from "./lib/linkGraph";
import { ISSUE_SOLUTIONS } from "./lib/issueSolutions";
import { parseUrlList } from "./lib/url";
import { type ExtractionColumn, extractedCell, getExtractionColumns } from "./lib/extraction";

type Tab = "overview" | "pages" | "resources" | "sitemap" | "compare";

/** How often link scores are recomputed while a crawl is running. PageRank is a whole-graph
 * computation, so it is not redone on every ~150 ms flush of new pages. */
const LINK_SCORE_INTERVAL_MS = 2000;


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

  const { filterContext, linkGraph, customSearchTracker, extractionIds, resetDerivedTrackers } =
    useDerivedCrawlState(pages, linkedUrls, shownSource.listMode);

  const {
    handleStart,
    handleStop,
    handlePause,
    handleResume,
    handleExport,
    handleSaveCrawl,
    handleOpenCrawl,
    handleExportIssues,
  } = useCrawlSession({
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
  });

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
