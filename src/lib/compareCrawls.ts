import type { PageResult, ResourceResult } from "../types";
import {
  type FilterContext,
  type IssueKey,
  countIssues,
  getCanonicalStatusMap,
  getDuplicateContentSet,
  getDuplicateH1Set,
  getDuplicateH2Set,
  getDuplicateMetaSet,
  getDuplicateTitleSet,
  getHreflangTracker,
  getNon200LinkSourceSet,
  getPageByUrlMap,
  getSitemapUsed,
} from "./filters";
import { buildLinkGraph } from "./linkGraph";
import { createNearDuplicateTracker, getNearDuplicateClusters, ingestNearDuplicatePage } from "./nearDuplicates";

/** The parts of a saved crawl a comparison reads. */
export interface ComparableCrawl {
  pages: PageResult[];
  resources: ResourceResult[];
}

export interface CompareOptions {
  /** Host (optionally with a port) rewritten to `mapHostTo` in both crawls before URLs are
   * matched, e.g. `staging.example.com` when comparing staging against production. */
  mapHostFrom?: string;
  mapHostTo?: string;
}

/** Page fields whose change marks a URL as changed. */
export type ComparedField = "status" | "indexability" | "title" | "metaDescription" | "h1" | "canonical" | "wordCount";

export type ComparedValue = string | number | null;

export interface FieldChange {
  name: ComparedField;
  before: ComparedValue;
  after: ComparedValue;
}

export interface ChangedUrl {
  url: string;
  fields: FieldChange[];
}

/** A URL present in only one of the two crawls, with enough of the page to recognise it. */
export interface CompareUrlRow {
  url: string;
  status: number | null;
  indexability: string;
  title: string | null;
}

export interface IssueDelta {
  key: IssueKey;
  before: number;
  after: number;
  /** False when either crawl predates a signal this issue depends on (see
   * `SIGNAL_FAMILIES`): its count there is unknown, so the delta means nothing. */
  comparable: boolean;
}

/** Pages dropped from one crawl because their URL matched an earlier page's after
 * normalization and host mapping (the first page is kept). */
export interface UrlCollisions {
  before: number;
  after: number;
}

export interface CrawlComparison {
  added: CompareUrlRow[];
  removed: CompareUrlRow[];
  changed: ChangedUrl[];
  /** Every issue in the registry, in registry order, with its count in each crawl. */
  issueDeltas: IssueDelta[];
  collisions: UrlCollisions;
}

/** Word count changes at or under this fraction of the earlier count are noise, not a change. */
export const WORD_COUNT_CHANGE_THRESHOLD = 0.2;

export const COMPARED_FIELD_LABELS: Record<ComparedField, string> = {
  status: "Status",
  indexability: "Indexability",
  title: "Title",
  metaDescription: "Meta description",
  h1: "H1",
  canonical: "Canonical",
  wordCount: "Word count",
};

/**
 * Reduces what a user typed as a host ("staging.example.com", "https://staging.example.com/",
 * "localhost:3000") to the lowercase `host` form `URL` produces, or "" when it is not a host.
 */
export function normalizeHostInput(input: string | undefined): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    return new URL(withScheme).host;
  } catch {
    return "";
  }
}

/** Host mapping resolved once per comparison. */
interface HostMapping {
  from: string;
  to: string;
}

function resolveMapping(options: CompareOptions): HostMapping | null {
  const from = normalizeHostInput(options.mapHostFrom);
  const to = normalizeHostInput(options.mapHostTo);
  return from && to && from !== to ? { from, to } : null;
}

/**
 * The key a URL is matched on: the fragment is removed and the host mapped when a mapping is
 * set. The path, including a trailing slash or its absence, is kept as is.
 */
export function comparisonUrl(url: string, options: CompareOptions = {}): string {
  return normalizeUrl(url, resolveMapping(options));
}

function normalizeUrl(url: string, mapping: HostMapping | null): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (mapping && parsed.host === mapping.from) parsed.host = mapping.to;
    return parsed.href;
  } catch {
    const hash = url.indexOf("#");
    return hash === -1 ? url : url.slice(0, hash);
  }
}

/**
 * The filter context of a finished crawl, built in one pass per helper (the same data
 * `App.tsx` builds incrementally for the live crawl). Saved crawls record neither their mode
 * nor the crawler's linked URL set, so they classify as spider crawls and a URL counts as
 * linked when any crawled page links to it.
 */
export function buildCrawlFilterContext(pages: PageResult[]): FilterContext {
  const linkedUrls = new Set<string>();
  for (const page of pages) for (const link of page.outlinks ?? []) linkedUrls.add(link.url);
  const nearDuplicateTracker = createNearDuplicateTracker();
  for (const page of pages) ingestNearDuplicatePage(nearDuplicateTracker, page);
  const hreflang = getHreflangTracker(pages);
  return {
    duplicateTitles: getDuplicateTitleSet(pages),
    duplicateContent: getDuplicateContentSet(pages),
    duplicateMeta: getDuplicateMetaSet(pages),
    duplicateH1s: getDuplicateH1Set(pages),
    duplicateH2s: getDuplicateH2Set(pages),
    canonicalStatusMap: getCanonicalStatusMap(pages),
    linkedUrls,
    pageByUrl: getPageByUrlMap(pages),
    sitemapUsed: getSitemapUsed(pages),
    linkGraph: buildLinkGraph(pages),
    non200LinkSources: getNon200LinkSourceSet(pages),
    hreflangMissingReturn: hreflang.missingReturn,
    hreflangTargetError: hreflang.targetError,
    nearDuplicates: getNearDuplicateClusters(nearDuplicateTracker),
    listMode: false,
  };
}

/** Issue counts of a finished crawl, classified exactly like the Overview. */
export function countCrawlIssues(crawl: ComparableCrawl): Record<IssueKey, number> {
  return countIssues(crawl.pages, crawl.resources, buildCrawlFilterContext(crawl.pages));
}

/**
 * A group of raw signals a crawler build started collecting at one point (M2 tasks), with a
 * test for whether a saved crawl has it and the issues that depend on it. Crawls saved before
 * the signal existed load with its default (empty, 0 or false), which would otherwise read as
 * "no issue" or, through the link graph, as "every page is an orphan".
 *
 * Each test is true when some page shows the signal, or when nothing in the crawl could have
 * produced it (so its absence is real).
 */
interface SignalFamily {
  name: string;
  captured: (crawl: ComparableCrawl) => boolean;
  issues: readonly IssueKey[];
}

export const SIGNAL_FAMILIES: readonly SignalFamily[] = [
  {
    name: "heading outline (T2.1)",
    captured: ({ pages }) => pages.some((p) => (p.headingLevels ?? []).length > 0) || !pages.some((p) => p.h1Count > 0),
    issues: ["h1TooLong", "missingH2", "multipleH2", "duplicateH2", "h2TooLong", "nonSequentialHeadings"],
  },
  {
    name: "title and meta counts, meta refresh, pagination (T2.2)",
    captured: ({ pages }) => pages.some((p) => (p.titleCount ?? 0) > 0) || !pages.some((p) => p.title),
    issues: ["multipleTitles", "multipleMetaDescriptions", "metaRefresh", "paginationTargetError"],
  },
  {
    name: "internal outlinks (T2.3)",
    captured: ({ pages }) =>
      pages.some((p) => (p.outlinks ?? []).length > 0) || !pages.some((p) => p.internalLinkCount > 0),
    issues: [
      "orphanPage",
      "internalRedirect",
      "singleInlink",
      "linksToErrorPages",
      "nonDescriptiveAnchors",
      "emptyAnchors",
    ],
  },
  {
    name: "security headers and mixed content (T2.5)",
    captured: ({ pages }) => pages.some((p) => p.securityHeadersCaptured) || !pages.some((p) => p.status !== null),
    issues: ["missingCsp", "missingFrameOptions", "missingContentTypeOptions", "missingReferrerPolicy", "mixedContent"],
  },
  {
    name: "hreflang links (T2.6)",
    captured: ({ pages }) =>
      pages.some((p) => (p.hreflangLinks ?? []).length > 0) || !pages.some((p) => (p.hreflangValues ?? []).length > 0),
    issues: [
      "hreflangMissingReturn",
      "hreflangMissingSelf",
      "hreflangMissingXDefault",
      "hreflangInvalidCode",
      "hreflangTargetError",
    ],
  },
  {
    name: "image dimensions and sizes (T2.7)",
    captured: ({ pages, resources }) =>
      pages.some((p) => (p.imagesMissingDimensions ?? 0) > 0) ||
      resources.some((r) => r.contentLength != null) ||
      (!pages.some((p) => p.imageCount > 0) && !resources.some((r) => r.resourceType === "image")),
    issues: ["imageMissingDimensions", "largeImage"],
  },
  {
    name: "content simhash (T2.8)",
    captured: ({ pages }) => pages.some((p) => p.contentSimhash) || !pages.some((p) => p.wordCount >= 20),
    issues: ["nearDuplicateContent"],
  },
  {
    // Raw HTML is only captured when the crawl rendered pages with the comparison option on,
    // so a crawl that rendered pages without it (or predates T3.6) has unknown counts.
    name: "raw vs rendered HTML (T3.6)",
    captured: ({ pages }) => pages.some((p) => p.raw) || !pages.some((p) => p.rendered),
    issues: ["jsChangesTitle", "jsChangesCanonical", "jsChangesRobots", "jsAddsMostContent", "jsAddsLinks"],
  },
];

/** Issues whose count is unknown in at least one of the two crawls. */
export function incomparableIssueKeys(before: ComparableCrawl, after: ComparableCrawl): Set<IssueKey> {
  const keys = new Set<IssueKey>();
  for (const family of SIGNAL_FAMILIES) {
    if (family.captured(before) && family.captured(after)) continue;
    for (const key of family.issues) keys.add(key);
  }
  return keys;
}

/** Empty text and a missing value are the same thing to a reader, and a field missing from an
 * older saved crawl must not read as a change. */
function text(value: string | null | undefined): string | null {
  return value ? value : null;
}

function wordCountChanged(before: number, after: number): boolean {
  return Math.abs(after - before) > before * WORD_COUNT_CHANGE_THRESHOLD;
}

function fieldChanges(before: PageResult, after: PageResult, mapping: HostMapping | null): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (name: ComparedField, a: ComparedValue, b: ComparedValue) => {
    if (a !== b) changes.push({ name, before: a, after: b });
  };
  push("status", before.status ?? null, after.status ?? null);
  push("indexability", text(before.indexability), text(after.indexability));
  push("title", text(before.title), text(after.title));
  push("metaDescription", text(before.metaDescription), text(after.metaDescription));
  push("h1", text(before.h1), text(after.h1));
  const canonicalBefore = text(before.canonical);
  const canonicalAfter = text(after.canonical);
  push(
    "canonical",
    canonicalBefore === null ? null : normalizeUrl(canonicalBefore, mapping),
    canonicalAfter === null ? null : normalizeUrl(canonicalAfter, mapping),
  );
  const wordsBefore = before.wordCount ?? 0;
  const wordsAfter = after.wordCount ?? 0;
  if (wordCountChanged(wordsBefore, wordsAfter)) {
    changes.push({ name: "wordCount", before: wordsBefore, after: wordsAfter });
  }
  return changes;
}

function byUrl(pages: PageResult[], mapping: HostMapping | null): { map: Map<string, PageResult>; collisions: number } {
  const map = new Map<string, PageResult>();
  let collisions = 0;
  for (const page of pages) {
    const key = normalizeUrl(page.url, mapping);
    if (map.has(key)) collisions++;
    else map.set(key, page);
  }
  return { map, collisions };
}

function urlRow(url: string, page: PageResult): CompareUrlRow {
  return { url, status: page.status ?? null, indexability: page.indexability ?? "", title: text(page.title) };
}

/**
 * Compares two saved crawls: URLs only in `after` (added), only in `before` (removed), in both
 * with a changed field (changed), and the count of every issue in each. Linear in the number
 * of pages: URLs are matched through maps, never pairwise.
 */
export function compareCrawls(
  before: ComparableCrawl,
  after: ComparableCrawl,
  options: CompareOptions = {},
): CrawlComparison {
  const mapping = resolveMapping(options);
  const beforeIndex = byUrl(before.pages, mapping);
  const afterIndex = byUrl(after.pages, mapping);
  const beforeByUrl = beforeIndex.map;
  const afterByUrl = afterIndex.map;

  const added: CompareUrlRow[] = [];
  const changed: ChangedUrl[] = [];
  for (const [url, afterPage] of afterByUrl) {
    const beforePage = beforeByUrl.get(url);
    if (!beforePage) {
      added.push(urlRow(url, afterPage));
      continue;
    }
    const fields = fieldChanges(beforePage, afterPage, mapping);
    if (fields.length > 0) changed.push({ url, fields });
  }
  const removed: CompareUrlRow[] = [];
  for (const [url, beforePage] of beforeByUrl) {
    if (!afterByUrl.has(url)) removed.push(urlRow(url, beforePage));
  }

  const countsBefore = countCrawlIssues(before);
  const countsAfter = countCrawlIssues(after);
  const incomparable = incomparableIssueKeys(before, after);
  const issueDeltas = (Object.keys(countsBefore) as IssueKey[]).map((key) => ({
    key,
    before: countsBefore[key],
    after: countsAfter[key],
    comparable: !incomparable.has(key),
  }));

  return {
    added,
    removed,
    changed,
    issueDeltas,
    collisions: { before: beforeIndex.collisions, after: afterIndex.collisions },
  };
}

/** One changed field of one URL, the row shape of the Compare view's Changed table. */
export interface ChangedFieldRow {
  url: string;
  field: string;
  before: ComparedValue;
  after: ComparedValue;
}

/** Flattens `changed` to one row per changed field, in URL then field order. */
export function changedFieldRows(changed: readonly ChangedUrl[]): ChangedFieldRow[] {
  const rows: ChangedFieldRow[] = [];
  for (const { url, fields } of changed) {
    for (const f of fields) rows.push({ url, field: COMPARED_FIELD_LABELS[f.name], before: f.before, after: f.after });
  }
  return rows;
}
