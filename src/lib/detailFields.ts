import type { PageResult, ResourceResult } from "@/types";
import { getMetaPixelWidth, getTitlePixelWidth } from "@/lib/filters";
import { type LinkGraph, getInlinkCount, getUniqueInlinkCount } from "@/lib/linkGraph";
import type { NearDuplicateCluster } from "@/lib/nearDuplicates";
import { type ExtractionColumn, extractedCell } from "@/lib/extraction";

/** One labelled row of a `DetailModal`. */
export interface DetailField {
  label: string;
  value: string | number | boolean | null | undefined;
  isError?: boolean;
}

/** What the page detail rows read besides the page itself. */
export interface PageDetailContext {
  customSearchColumns: readonly { id: string; label: string }[];
  extractionColumns: readonly ExtractionColumn[];
  linkGraph: LinkGraph;
  linkScores: Map<string, number>;
  nearDuplicates: Map<string, NearDuplicateCluster>;
}

/** The rows the page detail modal shows for `page`. */
export function pageDetailFields(
  page: PageResult,
  { customSearchColumns, extractionColumns, linkGraph, linkScores, nearDuplicates }: PageDetailContext,
): DetailField[] {
  return [
    { label: "URL", value: page.url },
    { label: "Status", value: page.status },
    { label: "Status Text", value: page.statusText },
    { label: "Indexability", value: page.indexability },
    { label: "Error", value: page.error, isError: true },
    { label: "Redirect URL", value: page.redirectUrl },
    { label: "Title", value: page.title },
    { label: "Title Length", value: page.titleLength },
    { label: "Title Width (px)", value: page.title ? getTitlePixelWidth(page) : null },
    { label: "Meta Description", value: page.metaDescription },
    { label: "Meta Description Length", value: page.metaDescriptionLength },
    { label: "Meta Description Width (px)", value: page.metaDescription ? getMetaPixelWidth(page) : null },
    { label: "H1", value: page.h1 },
    { label: "H1 Count", value: page.h1Count },
    { label: "Word Count", value: page.wordCount },
    ...customSearchColumns.map(({ id, label }) => ({
      label: `Custom search: ${label}`,
      value: page.customSearchCounts[id] ?? null,
    })),
    ...extractionColumns.map(({ id, label }) => ({
      label: `Extraction: ${label}`,
      value: extractedCell(page, id),
    })),
    { label: "Canonical", value: page.canonical },
    { label: "Meta Robots", value: page.metaRobots },
    { label: "Content Type", value: page.contentType },
    { label: "Response Time (ms)", value: page.responseTimeMs },
    { label: "Inlinks", value: getInlinkCount(linkGraph, page.url) },
    { label: "Unique Inlinks", value: getUniqueInlinkCount(linkGraph, page.url) },
    { label: "Link Score", value: linkScores.get(page.url) ?? null },
    { label: "Internal Links", value: page.internalLinkCount },
    { label: "External Links", value: page.externalLinkCount },
    { label: "Images", value: page.imageCount },
    { label: "Size (bytes)", value: page.htmlSizeBytes },
    { label: "Minified", value: page.htmlSizeBytes ? (page.isMinified ? "Yes" : "No") : null },
    {
      label: "Minify Savings",
      value: page.htmlSizeBytes ? `${page.minifySavingsPct.toFixed(0)}%` : null,
    },
    { label: "Depth", value: page.depth },
    { label: "JS Rendered", value: page.rendered ? "Yes" : "No" },
    // Raw (pre-JavaScript) values, only for pages compared with "Compare raw and rendered HTML".
    ...(page.raw
      ? [
          { label: "Raw Title", value: page.raw.title },
          { label: "Raw Canonical", value: page.raw.canonical },
          { label: "Raw Meta Robots", value: page.raw.metaRobots },
          { label: "Raw Word Count", value: page.raw.wordCount },
          { label: "Raw Internal Links", value: page.raw.internalLinkCount },
        ]
      : []),
    {
      label: "HSTS",
      value: page.url.startsWith("https:") ? (page.hsts ? "Yes" : "No") : null,
    },
    { label: "Insecure Links", value: page.insecureLinkCount },
    { label: "Missing Alt Images", value: page.missingAltCount },
    { label: "Lang Attribute", value: page.htmlSizeBytes ? page.lang : null },
    {
      label: "Hreflang",
      value: page.hreflangValues.length > 0 ? page.hreflangValues.join(", ") : null,
    },
    { label: "Internal Nofollow Links", value: page.internalNofollowCount },
    {
      label: "Text/HTML Ratio",
      value: page.htmlSizeBytes ? `${page.textRatioPct.toFixed(1)}%` : null,
    },
    { label: "Content Simhash", value: page.contentSimhash || null },
    {
      label: "Near-Duplicate Cluster Size",
      value: nearDuplicates.get(page.url)?.size ?? null,
    },
    { label: "X-Robots-Tag", value: page.xRobotsTag },
    { label: "Viewport", value: page.viewport },
    { label: "Open Graph Tags", value: page.hasOpenGraph ? "Yes" : "No" },
    { label: "Twitter Card Tags", value: page.hasTwitterCard ? "Yes" : "No" },
    { label: "Canonical Tag Count", value: page.canonicalCount },
    { label: "Discovered Via Sitemap", value: page.discoveredViaSitemap ? "Yes" : "No" },
    {
      label: "Redirect Chain",
      value: page.redirectChain.length > 0 ? page.redirectChain.join(" → ") : null,
    },
    {
      label: "Structured Data Types",
      value: page.structuredDataTypes.length > 0 ? page.structuredDataTypes.join(", ") : null,
    },
    {
      label: "Structured Data Errors",
      value: page.structuredDataErrors.length > 0 ? page.structuredDataErrors.join("; ") : null,
      isError: true,
    },
    {
      label: "Accessibility Violations",
      value:
        page.accessibilityViolations.length > 0
          ? page.accessibilityViolations.map((v) => `${v.id} (${v.nodeCount} nodes)`).join("; ")
          : null,
      isError: true,
    },
    {
      label: "Mobile Usability Violations",
      value:
        page.mobileUsabilityViolations.length > 0
          ? page.mobileUsabilityViolations.map((v) => `${v.id} (${v.nodeCount} nodes)`).join("; ")
          : null,
      isError: true,
    },
  ];
}

/** The rows the resource detail modal shows for `resource`. */
export function resourceDetailFields(resource: ResourceResult): DetailField[] {
  return [
    { label: "URL", value: resource.url },
    { label: "Type", value: resource.resourceType },
    { label: "Status", value: resource.status },
    { label: "Status Text", value: resource.statusText },
    { label: "Source Page", value: resource.sourcePage },
    { label: "Internal", value: resource.isInternal ? "Yes" : "No" },
    { label: "Alt Text", value: resource.altText },
    { label: "Insecure", value: resource.isInsecure ? "Yes" : "No" },
    { label: "Error", value: resource.error, isError: true },
  ];
}
