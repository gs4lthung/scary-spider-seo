import type { LinkRef, PageResult } from "../types";

/** One internal link pointing at a page, seen from the target's side. */
export interface Inlink {
  /** URL of the crawled page the link is on. */
  source: string;
  anchor: string;
  nofollow: boolean;
  isImageLink: boolean;
}

/** The links pointing at one target, stored as parallel arrays so ingesting a link allocates
 * no object (a 20k page crawl can hold millions of links). */
interface TargetInlinks {
  /** URL of the page each link is on. */
  sources: string[];
  links: LinkRef[];
  /** Number of distinct pages in `sources`. */
  uniqueSources: number;
}

/**
 * The internal link graph of a crawl, built from each page's `outlinks`. Keyed by target URL
 * (exact string match with `PageResult.url`, which is how the crawler records both). A page's
 * links to itself are left out: they are not a vote from another page.
 *
 * Built incrementally (`addPageToLinkGraph`) so a live crawl only ingests the pages that
 * arrived since the last UI flush.
 */
export interface LinkGraph {
  /** Target URL -> every link pointing at it from another crawled page, in crawl order. */
  targets: Map<string, TargetInlinks>;
  /** Every page ingested so far, in crawl order (the nodes `linkScore` ranks). */
  pages: PageResult[];
}

export function createLinkGraph(): LinkGraph {
  return { targets: new Map(), pages: [] };
}

/** Adds one crawled page's outlinks to the graph. */
export function addPageToLinkGraph(graph: LinkGraph, page: PageResult): void {
  graph.pages.push(page);
  for (const link of page.outlinks ?? []) {
    if (link.url === page.url) continue;
    let target = graph.targets.get(link.url);
    if (!target) {
      target = { sources: [], links: [], uniqueSources: 0 };
      graph.targets.set(link.url, target);
    }
    // A page's links are appended together, so a repeat link to the same target from this
    // page always finds this page as the last source.
    const sources = target.sources;
    if (sources.length === 0 || sources[sources.length - 1] !== page.url) target.uniqueSources++;
    sources.push(page.url);
    target.links.push(link);
  }
}

/** The link graph of a finished set of pages. */
export function buildLinkGraph(pages: readonly PageResult[]): LinkGraph {
  const graph = createLinkGraph();
  for (const page of pages) addPageToLinkGraph(graph, page);
  return graph;
}

/** Most links a page's detail view lists per direction; the full list is in "Export all
 * internal links". */
export const MAX_LINK_ROWS = 100;

/** The links pointing at `url` from other crawled pages, in crawl order, at most `limit` of
 * them. Allocates one object per link, so call it for a page being shown, not across the
 * whole crawl. */
export function getInlinks(graph: LinkGraph, url: string, limit = Infinity): Inlink[] {
  const target = graph.targets.get(url);
  if (!target) return [];
  return target.links.slice(0, limit).map((link, i) => ({
    source: target.sources[i],
    anchor: link.anchor,
    nofollow: link.nofollow,
    isImageLink: link.isImageLink,
  }));
}

/** Number of links pointing at `url` (a page linking twice counts twice). */
export function getInlinkCount(graph: LinkGraph, url: string): number {
  return graph.targets.get(url)?.links.length ?? 0;
}

/** Number of distinct pages linking to `url`. */
export function getUniqueInlinkCount(graph: LinkGraph, url: string): number {
  return graph.targets.get(url)?.uniqueSources ?? 0;
}

/**
 * Internal link score per crawled page: PageRank over the followed (not nofollow) links between
 * crawled pages, scaled so the best-linked page scores 100. Each source counts a target once
 * however many times it links to it. A page with no followed outlinks spreads its rank evenly
 * over every page, the standard treatment of dangling nodes. Scores have one decimal place.
 */
export function linkScore(graph: LinkGraph, iterations = 20, damping = 0.85): Map<string, number> {
  const pages = graph.pages;
  const n = pages.length;
  const scores = new Map<string, number>();
  if (n === 0) return scores;

  const indexOf = new Map<string, number>();
  pages.forEach((p, i) => indexOf.set(p.url, i));

  // Compressed adjacency: the targets of page i are edgeTargets[edgeStart[i] .. edgeStart[i + 1]).
  const edgeStart = new Int32Array(n + 1);
  const targets: number[] = [];
  // lastSource[j] === i marks target j as already counted for source i.
  const lastSource = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    edgeStart[i] = targets.length;
    for (const link of pages[i].outlinks ?? []) {
      if (link.nofollow) continue;
      const j = indexOf.get(link.url);
      if (j === undefined || j === i || lastSource[j] === i) continue;
      lastSource[j] = i;
      targets.push(j);
    }
  }
  edgeStart[n] = targets.length;
  const edgeTargets = Int32Array.from(targets);

  let rank = new Float64Array(n).fill(1 / n);
  let next = new Float64Array(n);
  for (let iter = 0; iter < iterations; iter++) {
    let dangling = 0;
    next.fill(0);
    for (let i = 0; i < n; i++) {
      const start = edgeStart[i];
      const end = edgeStart[i + 1];
      if (start === end) {
        dangling += rank[i];
        continue;
      }
      const share = rank[i] / (end - start);
      for (let e = start; e < end; e++) next[edgeTargets[e]] += share;
    }
    const base = (1 - damping) / n + (damping * dangling) / n;
    for (let i = 0; i < n; i++) next[i] = base + damping * next[i];
    [rank, next] = [next, rank];
  }

  let max = 0;
  for (let i = 0; i < n; i++) if (rank[i] > max) max = rank[i];
  for (let i = 0; i < n; i++) {
    const scaled = max > 0 ? (rank[i] / max) * 100 : 0;
    scores.set(pages[i].url, Math.round(scaled * 10) / 10);
  }
  return scores;
}
