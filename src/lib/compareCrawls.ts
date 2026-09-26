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
}

export interface CrawlComparison {
  added: CompareUrlRow[];
  removed: CompareUrlRow[];
  changed: ChangedUrl[];
  /** Every issue in the registry, in registry order, with its count in each crawl. */
  issueDeltas: IssueDelta[];
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

function byUrl(pages: PageResult[], mapping: HostMapping | null): Map<string, PageResult> {
  const map = new Map<string, PageResult>();
  for (const page of pages) map.set(normalizeUrl(page.url, mapping), page);
  return map;
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
  const beforeByUrl = byUrl(before.pages, mapping);
  const afterByUrl = byUrl(after.pages, mapping);

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
  const issueDeltas = (Object.keys(countsBefore) as IssueKey[]).map((key) => ({
    key,
    before: countsBefore[key],
    after: countsAfter[key],
  }));

  return { added, removed, changed, issueDeltas };
}
