import type { PageResult } from "../types";

/**
 * Near-duplicate content from the per-page `contentSimhash` (a 64-bit simhash of word
 * 3-shingles, computed by the crawler). Two pages are near duplicates when their fingerprints
 * differ in at most `NEAR_DUPLICATE_MAX_DISTANCE` bits and their exact `contentHash` differs
 * (exact copies are the `duplicateContent` issue). Near-duplicate pairs are chained into
 * clusters, as Screaming Frog does.
 *
 * Candidates are found with banding: each fingerprint is split into 4 bands of 16 bits and
 * bucketed by (band, value). By pigeonhole, fingerprints within 3 bits of each other share at
 * least one band exactly, so only pages in a shared bucket are compared. Pages are fed in one
 * at a time (`ingestNearDuplicatePage`), so a live crawl never rescans earlier pages.
 */

/** Largest Hamming distance (in bits, of 64) between two near-duplicate fingerprints. */
export const NEAR_DUPLICATE_MAX_DISTANCE = 3;

const BAND_COUNT = 4;
const BAND_BITS = 16;
const BAND_MASK = 0xffff;
const SIMHASH_PATTERN = /^[0-9a-f]{16}$/i;

/** A near-duplicate cluster; `size` counts every page in it, including exact copies. */
export interface NearDuplicateCluster {
  id: number;
  size: number;
}

/** One distinct fingerprint and the pages that carry it. */
interface SimhashNode {
  hi: number;
  lo: number;
  urls: string[];
  firstHash: string;
  /** A page with the same fingerprint but a different content hash than the first page, if any. */
  hasOtherHash: boolean;
}

export interface NearDuplicateTracker {
  maxDistance: number;
  nodes: SimhashNode[];
  nodeByHash: Map<string, number>;
  /** (band index << 16 | band value) -> node indexes. */
  buckets: Map<number, number[]>;
  /** Union-find parent per node. */
  parent: number[];
  /** Per root: number of nodes in its component. */
  componentNodes: number[];
  /** Per root: whether any node in its component has pages with different content hashes. */
  componentMixed: boolean[];
}

export function createNearDuplicateTracker(maxDistance = NEAR_DUPLICATE_MAX_DISTANCE): NearDuplicateTracker {
  if (!Number.isInteger(maxDistance) || maxDistance < 0 || maxDistance >= BAND_COUNT) {
    throw new RangeError(`maxDistance must be an integer from 0 to ${BAND_COUNT - 1}`);
  }
  return {
    maxDistance,
    nodes: [],
    nodeByHash: new Map(),
    buckets: new Map(),
    parent: [],
    componentNodes: [],
    componentMixed: [],
  };
}

/**
 * Whether a page takes part in near-duplicate detection: a fingerprinted (20+ words) HTML page
 * that answered 200 without redirecting and is indexable. Canonicalised, noindex and redirected
 * copies are left out, since pointing a copy's canonical at the original is the fix.
 */
export function isNearDuplicateCandidate(p: PageResult): boolean {
  return (
    !!p.contentSimhash &&
    SIMHASH_PATTERN.test(p.contentSimhash) &&
    p.htmlSizeBytes > 0 &&
    p.status === 200 &&
    p.redirectChain.length === 0 &&
    p.indexability === "Indexable"
  );
}

function popcount32(x: number): number {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Hamming distance between two 16-hex-char fingerprints. */
export function simhashDistance(a: string, b: string): number {
  const hiA = parseInt(a.slice(0, 8), 16);
  const loA = parseInt(a.slice(8), 16);
  const hiB = parseInt(b.slice(0, 8), 16);
  const loB = parseInt(b.slice(8), 16);
  return popcount32((hiA ^ hiB) >>> 0) + popcount32((loA ^ loB) >>> 0);
}

function bandKeys(hi: number, lo: number): number[] {
  return [
    (0 << BAND_BITS) | (hi >>> BAND_BITS),
    (1 << BAND_BITS) | (hi & BAND_MASK),
    (2 << BAND_BITS) | (lo >>> BAND_BITS),
    (3 << BAND_BITS) | (lo & BAND_MASK),
  ];
}

function find(tracker: NearDuplicateTracker, node: number): number {
  const { parent } = tracker;
  let root = node;
  while (parent[root] !== root) root = parent[root];
  while (parent[node] !== root) {
    const next = parent[node];
    parent[node] = root;
    node = next;
  }
  return root;
}

function union(tracker: NearDuplicateTracker, a: number, b: number): void {
  let rootA = find(tracker, a);
  let rootB = find(tracker, b);
  if (rootA === rootB) return;
  if (tracker.componentNodes[rootA] < tracker.componentNodes[rootB]) [rootA, rootB] = [rootB, rootA];
  tracker.parent[rootB] = rootA;
  tracker.componentNodes[rootA] += tracker.componentNodes[rootB];
  tracker.componentMixed[rootA] ||= tracker.componentMixed[rootB];
}

/** Feeds one crawled page into `tracker`. Pages that are not `isNearDuplicateCandidate` are ignored. */
export function ingestNearDuplicatePage(tracker: NearDuplicateTracker, page: PageResult): void {
  if (!isNearDuplicateCandidate(page)) return;
  const key = page.contentSimhash.toLowerCase();
  const existing = tracker.nodeByHash.get(key);
  if (existing !== undefined) {
    // Same fingerprint: a near duplicate of the earlier pages unless it is an exact copy of them.
    const node = tracker.nodes[existing];
    node.urls.push(page.url);
    if (!node.hasOtherHash && page.contentHash !== node.firstHash) {
      node.hasOtherHash = true;
      tracker.componentMixed[find(tracker, existing)] = true;
    }
    return;
  }

  const hi = parseInt(key.slice(0, 8), 16);
  const lo = parseInt(key.slice(8), 16);
  const index = tracker.nodes.length;
  tracker.nodes.push({ hi, lo, urls: [page.url], firstHash: page.contentHash, hasOtherHash: false });
  tracker.nodeByHash.set(key, index);
  tracker.parent.push(index);
  tracker.componentNodes.push(1);
  tracker.componentMixed.push(false);

  // Distinct fingerprints come from different texts, so their content hashes differ too: any
  // candidate within range is a near duplicate. A candidate sharing several bands is compared
  // more than once, which is harmless.
  for (const bandKey of bandKeys(hi, lo)) {
    const bucket = tracker.buckets.get(bandKey);
    if (!bucket) {
      tracker.buckets.set(bandKey, [index]);
      continue;
    }
    for (const other of bucket) {
      const node = tracker.nodes[other];
      const distance = popcount32((hi ^ node.hi) >>> 0) + popcount32((lo ^ node.lo) >>> 0);
      if (distance <= tracker.maxDistance) union(tracker, index, other);
    }
    bucket.push(index);
  }
}

/**
 * Every page that has at least one near duplicate, by URL, with its cluster. Cluster ids are
 * stable only within one snapshot. O(pages ingested), so call it once per batch, not per page.
 */
export function getNearDuplicateClusters(tracker: NearDuplicateTracker): Map<string, NearDuplicateCluster> {
  const clusters = new Map<string, NearDuplicateCluster>();
  const byRoot = new Map<number, NearDuplicateCluster>();
  tracker.nodes.forEach((node, index) => {
    const root = find(tracker, index);
    if (tracker.componentNodes[root] < 2 && !tracker.componentMixed[root]) return;
    let cluster = byRoot.get(root);
    if (!cluster) {
      cluster = { id: byRoot.size + 1, size: 0 };
      byRoot.set(root, cluster);
    }
    cluster.size += node.urls.length;
    for (const url of node.urls) clusters.set(url, cluster);
  });
  return clusters;
}

/**
 * Near-duplicate clusters for a complete page list: URL -> cluster id, for pages with at least
 * one near duplicate within `maxDistance` bits (0 to 3).
 */
export function findNearDuplicates(pages: PageResult[], maxDistance = NEAR_DUPLICATE_MAX_DISTANCE): Map<string, number> {
  const tracker = createNearDuplicateTracker(maxDistance);
  for (const page of pages) ingestNearDuplicatePage(tracker, page);
  const ids = new Map<string, number>();
  for (const [url, cluster] of getNearDuplicateClusters(tracker)) ids.set(url, cluster.id);
  return ids;
}
