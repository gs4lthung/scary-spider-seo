import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, SearchIcon, TriangleAlert, XCircle, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlCombobox } from "@/components/url-combobox";
import { CrawlActions } from "@/components/crawl-actions";
import { CrawlOptionsSheet } from "@/components/crawl-options-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Overview } from "./components/Overview";
import { DataTable } from "./components/DataTable";
import { DetailModal } from "./components/DetailModal";
import { LinkCell } from "./components/link-cell";
import { SiteTree } from "./components/SiteTree";
import { SiteInfoPanel } from "./components/SiteInfoPanel";
import {
  DEFAULT_CONFIG,
  type CrawlConfig,
  type CrawlProgress,
  type CrawlSnapshot,
  type CrawlSummary,
  type PageResult,
  type ResourceResult,
  type SiteInfo,
} from "./types";
import {
  type FilterKey,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
  createDuplicateTracker,
  filterPages,
  filterResources,
  filterTab,
  getPageIssueKeys,
  getResourceIssueKeys,
  ingestDuplicateValue,
  searchPages,
  searchResources,
} from "./lib/filters";
import { ISSUE_SOLUTIONS } from "./lib/issueSolutions";
import { cn } from "@/lib/utils";
import { withScheme } from "./lib/url";

type Tab = "overview" | "pages" | "resources" | "sitemap";

/** Wraps a cell's rendered value in destructive styling when `bad` is true — the inline, at-a-glance counterpart to DetailModal's `isError` fields. */
function flagCell(value: React.ReactNode, bad: boolean) {
  return bad ? <span className="font-medium text-destructive">{value}</span> : value;
}

/**
 * Renders a boolean as a colored icon instead of "Yes"/"No" text.
 * `badWhen` marks which boolean state (true or false) should render as a destructive red icon;
 * omit it when neither state is bad (just an informational true/false indicator).
 */
function boolCell(value: boolean, opts: { na?: boolean; badWhen?: boolean } = {}) {
  if (opts.na) return <span className="text-muted-foreground">–</span>;
  const isBad = opts.badWhen === value;
  const Icon = value ? CheckCircle2 : XCircle;
  return (
    <Icon
      className={cn(
        "size-4",
        isBad ? "text-destructive" : value ? "text-emerald-500" : "text-muted-foreground/40",
      )}
    />
  );
}

/** Renders a URL value as a clickable link (with a custom tooltip) that opens in the system browser. */
function linkCell(value: string | null | undefined) {
  if (!value) return value ?? "";
  return <LinkCell value={value} className="block w-full truncate" />;
}

interface PageColumnsContext {
  duplicateTitles: Set<string>;
  duplicateContent: Set<string>;
  duplicateMeta: Set<string>;
  canonicalStatusMap: Map<string, number | null>;
  linkedUrls: Set<string>;
}

function buildPageColumns(ctx: PageColumnsContext): ColumnDef<PageResult, any>[] {
  // The Issues column's accessorFn runs for every row on every table rebuild (react-table
  // builds the full row model regardless of virtualization), and its cell renderer runs
  // again for visible rows — without this cache that's getPageIssueKeys' 26 sub-filters
  // computed twice per row per update. Scoped to this ctx (rebuilt whenever ctx's deps
  // change), keyed by page object identity so unrelated pages never invalidate each other.
  const issueCache = new WeakMap<PageResult, FilterKey[]>();
  function issuesFor(page: PageResult): FilterKey[] {
    let keys = issueCache.get(page);
    if (!keys) {
      keys = getPageIssueKeys(
        page,
        ctx.duplicateTitles,
        ctx.duplicateContent,
        ctx.duplicateMeta,
        ctx.canonicalStatusMap,
        ctx.linkedUrls,
      );
      issueCache.set(page, keys);
    }
    return keys;
  }

  return [
    {
      accessorKey: "url",
      header: "URL",
      size: 430,
      cell: (c) => linkCell(c.getValue()),
      meta: { description: "The page's crawled URL. Click to open it in your browser." },
    },
    {
      id: "issues",
      header: "Issues",
      size: 80,
      meta: { description: "Number of SEO issues detected for this page. Hover the warning icon in a row for details." },
      accessorFn: (page) => issuesFor(page).length,
      // A native `title` tooltip rather than the Radix Tooltip used elsewhere in the app:
      // this cell renders for every visible row of a virtualized table (most rows have
      // >=1 issue), and mounting a JS-positioned tooltip per row measurably added up
      // during fast scrolling — rows would render blank until React caught up. `title`
      // supports the same newline-joined multi-issue list at effectively zero cost.
      cell: (c) => {
        const count = c.getValue() as number;
        if (count === 0) return <span className="text-muted-foreground">—</span>;
        const keys = issuesFor(c.row.original);
        const titles = keys.map((k) => ISSUE_SOLUTIONS[k]?.title).filter(Boolean);
        return (
          <span title={titles.join("\n")} className="inline-flex items-center gap-1 font-medium text-destructive">
            <TriangleAlert className="size-3.5" />
            {count}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 80,
      meta: { description: "The HTTP response status code returned when the page was crawled (e.g. 200, 404, 500)." },
      cell: (c) => {
        const v = c.getValue();
        return flagCell(v ?? "-", v === null || v >= 400);
      },
    },
    {
      accessorKey: "indexability",
      header: "Indexability",
      size: 190,
      meta: { description: "Whether search engines are allowed to index this page, based on robots meta tags and headers." },
    },
    {
      accessorKey: "title",
      header: "Title",
      size: 310,
      meta: { description: "The page's <title> tag content, as shown in search results and browser tabs." },
      cell: (c) => {
        const v = c.getValue() as string | null;
        return flagCell(v ?? "", !v || ctx.duplicateTitles.has(v));
      },
    },
    {
      accessorKey: "titleLength",
      header: "Title Len",
      size: 100,
      meta: { description: `Character length of the title tag. Flagged outside the recommended ${TITLE_MIN_LENGTH}–${TITLE_MAX_LENGTH} range.` },
      cell: (c) => {
        const v = c.getValue() as number;
        const hasTitle = !!c.row.original.title;
        return flagCell(v, hasTitle && (v < TITLE_MIN_LENGTH || v > TITLE_MAX_LENGTH));
      },
    },
    {
      accessorKey: "metaDescription",
      header: "Meta Description",
      size: 310,
      meta: { description: "The page's meta description tag content, often shown as the snippet in search results." },
      cell: (c) => {
        const v = c.getValue() as string | null;
        return flagCell(v ?? "", !v || ctx.duplicateMeta.has(v));
      },
    },
    {
      accessorKey: "metaDescriptionLength",
      header: "Meta Len",
      size: 100,
      meta: { description: "Character length of the meta description tag." },
    },
    {
      accessorKey: "h1",
      header: "H1",
      size: 240,
      meta: { description: "The page's first <h1> heading text." },
      cell: (c) => flagCell(c.getValue() ?? "", c.row.original.h1Count !== 1),
    },
    {
      accessorKey: "h1Count",
      header: "H1 Count",
      size: 100,
      meta: { description: "Number of <h1> tags found on the page. Flagged when not exactly one." },
      cell: (c) => flagCell(c.getValue(), c.getValue() !== 1),
    },
    {
      accessorKey: "wordCount",
      header: "Word Count",
      size: 120,
      meta: { description: "Number of words in the page's visible text content." },
    },
    {
      accessorKey: "canonical",
      header: "Canonical",
      size: 310,
      meta: { description: "The canonical URL declared for this page, telling search engines which version to index." },
      cell: (c) => {
        const page = c.row.original;
        const target = page.canonical;
        const brokenTarget =
          !!target &&
          target !== page.url &&
          ctx.canonicalStatusMap.has(target) &&
          (ctx.canonicalStatusMap.get(target) === null || (ctx.canonicalStatusMap.get(target) as number) >= 400);
        return flagCell(target ? linkCell(target) : "", page.canonicalCount > 1 || brokenTarget);
      },
    },
    {
      accessorKey: "responseTimeMs",
      header: "Time (ms)",
      size: 110,
      meta: { description: "Server response time, in milliseconds." },
    },
    {
      accessorKey: "internalLinkCount",
      header: "Inlinks",
      size: 100,
      meta: { description: "Number of internal links found on this page." },
    },
    {
      accessorKey: "externalLinkCount",
      header: "Outlinks",
      size: 100,
      meta: { description: "Number of external (off-site) links found on this page." },
    },
    {
      accessorKey: "imageCount",
      header: "Images",
      size: 80,
      meta: { description: "Number of images found on this page." },
    },
    {
      accessorKey: "htmlSizeBytes",
      header: "Size (KB)",
      size: 110,
      meta: { description: "Size of the raw HTML response." },
      cell: (c) => (c.getValue() ? (c.getValue() / 1024).toFixed(1) : "-"),
    },
    {
      accessorKey: "isMinified",
      header: "Minified",
      size: 110,
      meta: { description: "Whether the HTML appears minified (extra whitespace and comments stripped)." },
      cell: (c) => boolCell(c.getValue() as boolean, { na: !c.row.original.htmlSizeBytes }),
    },
    {
      accessorKey: "minifySavingsPct",
      header: "Minify Savings",
      size: 130,
      meta: { description: "Estimated percentage the HTML's size could shrink by if it were minified." },
      cell: (c) => (c.row.original.htmlSizeBytes ? `${(c.getValue() as number).toFixed(0)}%` : "-"),
    },
    {
      accessorKey: "depth",
      header: "Depth",
      size: 70,
      meta: { description: "Number of clicks from the crawl's start URL needed to reach this page." },
    },
    {
      accessorKey: "rendered",
      header: "JS Rendered",
      size: 120,
      meta: { description: "Whether this page was rendered with JavaScript execution during the crawl." },
      cell: (c) => boolCell(c.getValue() as boolean),
    },
    {
      accessorKey: "hsts",
      header: "HSTS",
      size: 100,
      meta: { description: "Whether the Strict-Transport-Security header was present on this HTTPS response." },
      cell: (c) => {
        const isHttps = c.row.original.url.startsWith("https:");
        return boolCell(c.getValue() as boolean, { na: !isHttps, badWhen: false });
      },
    },
    {
      accessorKey: "insecureLinkCount",
      header: "Insecure Links",
      size: 130,
      meta: { description: "Number of links on this page pointing to insecure (HTTP) URLs." },
      cell: (c) => flagCell(c.getValue(), (c.getValue() as number) > 0),
    },
    {
      accessorKey: "missingAltCount",
      header: "Missing Alt",
      size: 120,
      meta: { description: "Number of images on this page missing alt text." },
      cell: (c) => flagCell(c.getValue(), (c.getValue() as number) > 0),
    },
    {
      accessorKey: "lang",
      header: "Lang",
      size: 100,
      meta: { description: "The declared language (lang attribute) of the HTML document." },
      cell: (c) => {
        const hasHtml = !!c.row.original.htmlSizeBytes;
        return flagCell(hasHtml ? (c.getValue() ?? "-") : "-", hasHtml && !c.getValue());
      },
    },
    {
      accessorKey: "hreflangValues",
      header: "Hreflang",
      size: 170,
      meta: { description: "Declared hreflang alternate language/region values for this page." },
      cell: (c) => (c.getValue() as string[]).join(", "),
    },
    {
      accessorKey: "internalNofollowCount",
      header: "Nofollow Links",
      size: 130,
      meta: { description: "Number of internal links on this page marked rel=\"nofollow\"." },
    },
    {
      accessorKey: "textRatioPct",
      header: "Text/HTML Ratio",
      size: 140,
      meta: { description: "Percentage of visible text relative to the total HTML size. Low ratios can signal thin content." },
      cell: (c) => (c.row.original.htmlSizeBytes ? `${(c.getValue() as number).toFixed(1)}%` : "-"),
    },
    {
      accessorKey: "viewport",
      header: "Viewport",
      size: 110,
      meta: { description: "Whether a responsive viewport meta tag is present." },
      cell: (c) => boolCell(c.getValue() as boolean, { na: !c.row.original.htmlSizeBytes }),
    },
    {
      accessorKey: "hasOpenGraph",
      header: "Open Graph",
      size: 120,
      meta: { description: "Whether Open Graph (og:) social sharing meta tags are present." },
      cell: (c) => boolCell(c.getValue() as boolean),
    },
    {
      accessorKey: "hasTwitterCard",
      header: "Twitter Card",
      size: 120,
      meta: { description: "Whether Twitter Card meta tags are present." },
      cell: (c) => boolCell(c.getValue() as boolean),
    },
    {
      accessorKey: "canonicalCount",
      header: "Canonical Count",
      size: 130,
      meta: { description: "Number of canonical tags declared on the page. Flagged when more than one." },
      cell: (c) => flagCell(c.getValue(), (c.getValue() as number) > 1),
    },
    {
      accessorKey: "redirectChain",
      header: "Redirect Hops",
      size: 130,
      meta: { description: "Number of redirects followed to reach the final URL. Flagged when more than one hop." },
      cell: (c) => flagCell((c.getValue() as string[]).length, (c.getValue() as string[]).length > 1),
    },
    {
      accessorKey: "discoveredViaSitemap",
      header: "Via Sitemap",
      size: 120,
      meta: { description: "Whether this page was discovered via the XML sitemap rather than by crawling links." },
      cell: (c) => boolCell(c.getValue() as boolean),
    },
    {
      accessorKey: "structuredDataTypes",
      header: "Structured Data",
      size: 180,
      meta: { description: "Schema.org structured data types detected on the page (e.g. Article, Product)." },
      cell: (c) => (c.getValue() as string[]).join(", "),
    },
    {
      accessorKey: "accessibilityViolations",
      header: "A11y Issues",
      size: 120,
      meta: { description: "Number of accessibility violations detected on the page." },
      cell: (c) => flagCell((c.getValue() as unknown[]).length, (c.getValue() as unknown[]).length > 0),
    },
    {
      accessorKey: "mobileUsabilityViolations",
      header: "Mobile Usability Issues",
      size: 170,
      meta: { description: "Number of mobile usability violations (content width, font size, tap targets) detected on the page." },
      cell: (c) => flagCell((c.getValue() as unknown[]).length, (c.getValue() as unknown[]).length > 0),
    },
  ];
}

const resourceColumns: ColumnDef<ResourceResult, any>[] = [
  {
    accessorKey: "url",
    header: "URL",
    size: 460,
    meta: { description: "The resource's URL (a link or image). Click to open it in your browser." },
    cell: (c) => linkCell(c.getValue()),
  },
  {
    accessorKey: "resourceType",
    header: "Type",
    size: 100,
    meta: { description: "Whether this resource is a link or an image." },
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 80,
    meta: { description: "The HTTP response status code returned for this resource." },
    cell: (c) => {
      const v = c.getValue();
      return flagCell(v ?? "-", v === null || v >= 400);
    },
  },
  {
    accessorKey: "statusText",
    header: "Status Text",
    size: 190,
    meta: { description: "The HTTP status message returned for this resource." },
  },
  {
    accessorKey: "sourcePage",
    header: "Source Page",
    size: 430,
    meta: { description: "The page this resource was found on. Click to open it in your browser." },
    cell: (c) => linkCell(c.getValue()),
  },
  {
    accessorKey: "isInternal",
    header: "Internal",
    size: 100,
    meta: { description: "Whether the resource is hosted on the same site as the crawled page." },
    cell: (c) => boolCell(c.getValue() as boolean),
  },
  {
    accessorKey: "altText",
    header: "Alt Text",
    size: 240,
    meta: { description: "The alt attribute text for image resources." },
    cell: (c) => c.getValue() ?? "",
  },
  {
    accessorKey: "isInsecure",
    header: "Insecure",
    size: 100,
    meta: { description: "Whether the resource is served over an insecure (HTTP) connection." },
    cell: (c) => boolCell(c.getValue() as boolean, { badWhen: true }),
  },
  {
    accessorKey: "error",
    header: "Error",
    size: 240,
    meta: { description: "The error message if this resource failed to load." },
    cell: (c) => flagCell(c.getValue() ?? "", !!c.getValue()),
  },
];

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
  const pagesBufRef = useRef<PageResult[]>([]);
  const resourcesBufRef = useRef<ResourceResult[]>([]);
  // Backs the duplicate-title/meta/content and canonical-status derivations below with
  // incremental accumulators instead of full-array rescans (see the useMemo that reads
  // them for why). Reset via resetDerivedTrackers() whenever `pages` is replaced wholesale
  // rather than appended to.
  const titleTrackerRef = useRef(createDuplicateTracker());
  const contentTrackerRef = useRef(createDuplicateTracker());
  const metaTrackerRef = useRef(createDuplicateTracker());
  const canonicalStatusRef = useRef(new Map<string, number | null>());
  const ingestedPagesCountRef = useRef(0);

  const resetDerivedTrackers = useCallback(() => {
    titleTrackerRef.current = createDuplicateTracker();
    contentTrackerRef.current = createDuplicateTracker();
    metaTrackerRef.current = createDuplicateTracker();
    canonicalStatusRef.current = new Map();
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

  useEffect(() => {
    // `listen()`/unlisten are async, and React StrictMode's dev-only
    // mount->unmount->remount cycle can leave a stale listener from the first
    // mount briefly registered alongside the second mount's listener before its
    // unlisten call resolves. Without this guard, events fired in that overlap
    // window get processed twice (e.g. duplicate rows for the same page).
    let active = true;
    const unlistenFns: Array<() => void> = [];
    let flushHandle: number | undefined;

    function scheduleFlush() {
      if (flushHandle !== undefined) return;
      flushHandle = window.setTimeout(() => {
        flushHandle = undefined;
        if (pagesBufRef.current.length > 0) {
          const batch = pagesBufRef.current;
          pagesBufRef.current = [];
          setPages((prev) => [...prev, ...batch]);
        }
        if (resourcesBufRef.current.length > 0) {
          const batch = resourcesBufRef.current;
          resourcesBufRef.current = [];
          setResources((prev) => [...prev, ...batch]);
        }
      }, 150);
    }

    async function registerListener<T>(event: string, handler: (payload: T) => void) {
      const unlisten = await listen<T>(event, (e) => {
        if (!active) return;
        handler(e.payload);
      });
      if (!active) {
        unlisten();
        return;
      }
      unlistenFns.push(unlisten);
    }

    (async () => {
      await registerListener<PageResult>("crawl://page", (payload) => {
        pagesBufRef.current.push(payload);
        scheduleFlush();
      });
      await registerListener<ResourceResult>("crawl://resource", (payload) => {
        resourcesBufRef.current.push(payload);
        scheduleFlush();
      });
      await registerListener<SiteInfo>("crawl://site_info", (payload) => {
        setSiteInfo(payload);
      });
      await registerListener<CrawlProgress>("crawl://progress", (payload) => {
        setProgress(payload);
        setPaused(payload.paused);
      });
      await registerListener<CrawlSummary>("crawl://done", (payload) => {
        setRunning(false);
        setPaused(false);
        setLinkedUrls(payload.linkedUrls);
        setProgress((prev) => (prev ? { ...prev, running: false, paused: false } : prev));
        setResumableStartUrl(payload.resumable ? activeStartUrlRef.current : null);
      });
      await registerListener<string>("crawl://error", (payload) => {
        toast.error(payload);
        setRunning(false);
      });
    })();

    return () => {
      active = false;
      if (flushHandle !== undefined) window.clearTimeout(flushHandle);
      unlistenFns.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    closeGuardRef.current = { running, pagesCount: pages.length, resourcesCount: resources.length };
  }, [running, pages.length, resources.length]);

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
    // A URL typed without a scheme (e.g. "example.com") gets the checkbox's preferred
    // one; a URL that already specifies http:// or https:// is left untouched.
    const startUrl = withScheme(config.startUrl, preferHttps);
    const nextConfig = { ...config, startUrl };

    // Continuing a crawl stopped with URLs still queued (the backend kept its frontier
    // for this exact start URL — see AppState.resume_state): keep the results gathered
    // so far instead of wiping them, since the backend will append to them, not replace
    // them. A different start URL (or a crawl that ran to completion) always starts fresh.
    const continuing = resumableStartUrl === startUrl;
    activeStartUrlRef.current = startUrl;
    if (!continuing) {
      setPages([]);
      setResources([]);
      setSiteInfo(null);
      setLinkedUrls([]);
      resetDerivedTrackers();
      pagesBufRef.current = [];
      resourcesBufRef.current = [];
    }
    setConfig(nextConfig);
    setProgress(null);
    setFilter("all");
    setPaused(false);
    setRunning(true);
    try {
      await invoke("start_crawl", { config: nextConfig });
    } catch (err) {
      toast.error(String(err));
      setRunning(false);
    }
  }, [config, preferHttps, resumableStartUrl, resetDerivedTrackers]);

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

  const handleExport = useCallback(async (what: "pages" | "resources") => {
    try {
      const path = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: `${what}-export.csv`,
      });
      if (!path) return;
      await invoke("export_csv", { path, what });
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const handleSaveCrawl = useCallback(async () => {
    try {
      const path = await save({
        filters: [{ name: "Scary Spider SEO Crawl", extensions: ["json"] }],
        defaultPath: "crawl.json",
      });
      if (!path) return;
      await invoke("save_crawl", { path, startUrl: config.startUrl });
    } catch (err) {
      toast.error(String(err));
    }
  }, [config.startUrl]);

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
    } catch (err) {
      toast.error(String(err));
    }
  }, [resetDerivedTrackers]);

  // Ingests only the pages not yet seen by the trackers (normally just the latest batch —
  // `pages` only grows by appending during a crawl) instead of rescanning/rehashing every
  // page crawled so far on every ~150ms UI flush, which is what made this cost trend toward
  // O(n²) over a long crawl. Still produces fresh Set/Map instances each time so downstream
  // useMemo/props comparisons below see them exactly as before.
  const { duplicateTitleSet, duplicateContentSet, duplicateMetaSet, canonicalStatusMap } = useMemo(() => {
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
      canonicalStatusRef.current.set(p.url, p.status);
    }
    ingestedPagesCountRef.current = pages.length;

    return {
      duplicateTitleSet: new Set(titleTrackerRef.current.duplicates),
      duplicateContentSet: new Set(contentTrackerRef.current.duplicates),
      duplicateMetaSet: new Set(metaTrackerRef.current.duplicates),
      canonicalStatusMap: new Map(canonicalStatusRef.current),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trackers are refs, intentionally excluded
  }, [pages]);
  const linkedUrlSet = useMemo(() => new Set(linkedUrls), [linkedUrls]);
  const filteredPages = useMemo(
    () =>
      searchPages(
        filterPages(pages, filter, duplicateTitleSet, duplicateContentSet, duplicateMetaSet, canonicalStatusMap, linkedUrlSet),
        search,
      ),
    [pages, filter, search, duplicateTitleSet, duplicateContentSet, duplicateMetaSet, canonicalStatusMap, linkedUrlSet],
  );
  const filteredResources = useMemo(
    () => searchResources(filterResources(resources, filter), search),
    [resources, filter, search],
  );

  const pageColumns = useMemo(
    () =>
      buildPageColumns({
        duplicateTitles: duplicateTitleSet,
        duplicateContent: duplicateContentSet,
        duplicateMeta: duplicateMetaSet,
        canonicalStatusMap,
        linkedUrls: linkedUrlSet,
      }),
    [duplicateTitleSet, duplicateContentSet, duplicateMetaSet, canonicalStatusMap, linkedUrlSet],
  );

  const selectedPageIssues = useMemo(() => {
    if (!selectedPage) return [];
    return getPageIssueKeys(selectedPage, duplicateTitleSet, duplicateContentSet, duplicateMetaSet, canonicalStatusMap, linkedUrlSet)
      .map((key) => ISSUE_SOLUTIONS[key])
      .filter((s) => s !== undefined);
  }, [selectedPage, duplicateTitleSet, duplicateContentSet, duplicateMetaSet, canonicalStatusMap, linkedUrlSet]);

  const selectedResourceIssues = useMemo(() => {
    if (!selectedResource) return [];
    return getResourceIssueKeys(selectedResource)
      .map((key) => ISSUE_SOLUTIONS[key])
      .filter((s) => s !== undefined);
  }, [selectedResource]);

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
        <UrlCombobox
          value={config.startUrl}
          disabled={running}
          onChange={(startUrl) => setConfig((c) => ({ ...c, startUrl }))}
          onSubmit={handleStart}
          preferHttps={preferHttps}
          onToggleScheme={() => setPreferHttps((v) => !v)}
        />
        <CrawlActions
          running={running}
          paused={paused}
          canStart={!!config.startUrl}
          continuing={resumableStartUrl === config.startUrl}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
        />
        <CrawlOptionsSheet config={config} running={running} onChange={setConfig} />
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
        </div>

        <TabsContent value="overview" className="flex flex-col gap-4 overflow-y-auto">
          {siteInfo && <SiteInfoPanel siteInfo={siteInfo} />}
          <Overview
            pages={pages}
            resources={resources}
            linkedUrls={linkedUrlSet}
            duplicateTitles={duplicateTitleSet}
            duplicateContent={duplicateContentSet}
            duplicateMeta={duplicateMetaSet}
            canonicalStatusMap={canonicalStatusMap}
            progress={progress}
            running={running}
            paused={paused}
            activeFilter={filter}
            onSelectFilter={handleSelectFilter}
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
            duplicateTitles={duplicateTitleSet}
            duplicateContent={duplicateContentSet}
            duplicateMeta={duplicateMetaSet}
            canonicalStatusMap={canonicalStatusMap}
            linkedUrls={linkedUrlSet}
            onSelectPage={setSelectedPage}
            onViewInPages={handleViewInPages}
          />
        </TabsContent>
      </Tabs>

      {selectedPage && (
        <DetailModal
          title={selectedPage.url}
          onClose={() => setSelectedPage(null)}
          issues={selectedPageIssues}
          fields={[
            { label: "URL", value: selectedPage.url },
            { label: "Status", value: selectedPage.status },
            { label: "Status Text", value: selectedPage.statusText },
            { label: "Indexability", value: selectedPage.indexability },
            { label: "Error", value: selectedPage.error, isError: true },
            { label: "Redirect URL", value: selectedPage.redirectUrl },
            { label: "Title", value: selectedPage.title },
            { label: "Title Length", value: selectedPage.titleLength },
            { label: "Meta Description", value: selectedPage.metaDescription },
            { label: "Meta Description Length", value: selectedPage.metaDescriptionLength },
            { label: "H1", value: selectedPage.h1 },
            { label: "H1 Count", value: selectedPage.h1Count },
            { label: "Word Count", value: selectedPage.wordCount },
            { label: "Canonical", value: selectedPage.canonical },
            { label: "Meta Robots", value: selectedPage.metaRobots },
            { label: "Content Type", value: selectedPage.contentType },
            { label: "Response Time (ms)", value: selectedPage.responseTimeMs },
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
