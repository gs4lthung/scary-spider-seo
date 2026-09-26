import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkCell } from "@/components/link-cell";
import type { PageResult } from "@/types";
import {
  type FilterContext,
  type IssueKey,
  META_MAX_PIXELS,
  META_MIN_PIXELS,
  TITLE_MAX_LENGTH,
  TITLE_MAX_PIXELS,
  TITLE_MIN_LENGTH,
  TITLE_MIN_PIXELS,
  getMetaPixelWidth,
  getPageIssueKeys,
  getTitlePixelWidth,
} from "@/lib/filters";
import { getInlinkCount, getUniqueInlinkCount } from "@/lib/linkGraph";
import { ISSUE_SOLUTIONS } from "@/lib/issueSolutions";
import { type ExtractionColumn, extractedCell } from "@/lib/extraction";

/** Wraps a cell's rendered value in destructive styling when `bad` is true — the inline, at-a-glance counterpart to DetailModal's `isError` fields. */
export function flagCell(value: React.ReactNode, bad: boolean) {
  return bad ? <span className="font-medium text-destructive">{value}</span> : value;
}

/**
 * Renders a boolean as a colored icon instead of "Yes"/"No" text.
 * `badWhen` marks which boolean state (true or false) should render as a destructive red icon;
 * omit it when neither state is bad (just an informational true/false indicator).
 */
export function boolCell(value: boolean, opts: { na?: boolean; badWhen?: boolean } = {}) {
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
export function linkCell(value: string | null | undefined) {
  if (!value) return value ?? "";
  return <LinkCell value={value} className="block w-full truncate" />;
}

/** A custom search rule shown as a Pages table column (see `customSearchColumns` in `App`). */
export interface CustomSearchColumn {
  id: string;
  label: string;
}

export function buildPageColumns(
  ctx: FilterContext,
  linkScores: Map<string, number>,
  customSearches: readonly CustomSearchColumn[],
  extractions: readonly ExtractionColumn[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack's idiom for columns with mixed value types
): ColumnDef<PageResult, any>[] {
  // The Issues column's accessorFn runs for every row on every table rebuild (react-table
  // builds the full row model regardless of virtualization), and its cell renderer runs
  // again for visible rows — without this cache that's getPageIssueKeys' 26 sub-filters
  // computed twice per row per update. Scoped to this ctx (rebuilt whenever ctx's deps
  // change), keyed by page object identity so unrelated pages never invalidate each other.
  const issueCache = new WeakMap<PageResult, IssueKey[]>();
  function issuesFor(page: PageResult): IssueKey[] {
    let keys = issueCache.get(page);
    if (!keys) {
      keys = getPageIssueKeys(page, ctx);
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
        const titles = keys.map((k) => ISSUE_SOLUTIONS[k].title);
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
      id: "titlePixels",
      header: "Title px",
      size: 100,
      meta: {
        description: `Estimated width of the title in Google results (Arial 20 px). Flagged outside the ${TITLE_MIN_PIXELS}–${TITLE_MAX_PIXELS} px range.`,
      },
      accessorFn: (page) => getTitlePixelWidth(page),
      cell: (c) => {
        const v = c.getValue() as number;
        const hasTitle = !!c.row.original.title;
        return flagCell(hasTitle ? v : "", hasTitle && (v < TITLE_MIN_PIXELS || v > TITLE_MAX_PIXELS));
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
      id: "metaPixels",
      header: "Meta px",
      size: 100,
      meta: {
        description: `Estimated width of the meta description in Google results (Arial 14 px). Flagged outside the ${META_MIN_PIXELS}–${META_MAX_PIXELS} px range.`,
      },
      accessorFn: (page) => getMetaPixelWidth(page),
      cell: (c) => {
        const v = c.getValue() as number;
        const hasMeta = !!c.row.original.metaDescription;
        return flagCell(hasMeta ? v : "", hasMeta && (v < META_MIN_PIXELS || v > META_MAX_PIXELS));
      },
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
      id: "inlinks",
      header: "Inlinks",
      size: 100,
      accessorFn: (page) => getInlinkCount(ctx.linkGraph, page.url),
      meta: { description: "Number of internal links pointing at this page from other crawled pages." },
    },
    {
      id: "uniqueInlinks",
      header: "Unique Inlinks",
      size: 130,
      accessorFn: (page) => getUniqueInlinkCount(ctx.linkGraph, page.url),
      meta: { description: "Number of distinct crawled pages that link to this page." },
    },
    {
      id: "linkScore",
      header: "Link Score",
      size: 110,
      accessorFn: (page) => linkScores.get(page.url) ?? 0,
      meta: {
        description:
          "Internal link score from 0 to 100: PageRank over the followed internal links, where the best linked page scores 100. Refreshes every 2 seconds during a crawl.",
      },
    },
    {
      accessorKey: "internalLinkCount",
      header: "Internal Outlinks",
      size: 140,
      meta: { description: "Number of internal links found on this page." },
    },
    {
      accessorKey: "externalLinkCount",
      header: "External Outlinks",
      size: 140,
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
    // One column per custom search rule: its match count, blank where the rule never ran
    // (non-HTML or blocked URLs, pages crawled before the rule existed).
    ...customSearches.map(
      ({ id, label }): ColumnDef<PageResult, number | null> => ({
        id: `custom:${id}`,
        header: label,
        size: 140,
        meta: { description: `Custom search "${label}": number of matches on the page.` },
        accessorFn: (page) => page.customSearchCounts[id] ?? null,
      }),
    ),
    // One column per custom extraction rule: its values joined with " | ", blank where
    // nothing matched or the rule never ran.
    ...extractions.map(
      ({ id, label }): ColumnDef<PageResult, string | null> => ({
        id: `extract:${id}`,
        header: label,
        size: 220,
        meta: { description: `Custom extraction "${label}": values matched on the page, joined with " | ".` },
        accessorFn: (page) => extractedCell(page, id),
      }),
    ),
  ];
}
